const LeadModel = require("../leads/lead.model");
const PaymentLinks = require("../payments/payment-links");
const LeadService = require("../leads/lead.service");
const LearnerService = require("../learners/learner.service");
const LearnerModel = require("../learners/learner.model");
const AuthService = require("../auth/auth.service");
const UserModel = require("../auth/user.model");
const { parentLoginFor } = require("../auth/parent-login");
const BootcampModel = require("../bootcamps/bootcamp.model");
const BootcampHubModel = require("../bootcamps/bootcamp-hub.model");
const LearningHubModel = require("../learning-hubs/learning-hub.model");
const BillingModel = require("../billing/billing.model");
const NotificationService = require("../notifications/notification.service");
const { resolveForSaleBootcamp } = require("../public-site/public-bootcamp.service");
const { resolveEffectiveBootcampPrice } = require("../../shared/utils/bootcamp-pricing");
const { slugify } = require("../../shared/utils/slugify");
const { ageFrom } = require("../../shared/utils/age");
const { pathwayRowsFor } = require("../../shared/utils/public-content");
const LearnerHubLinkModel = require("../learners/learner-hub-link.model");
const LearnerPathwayModel = require("../curriculum/competency-framework/learner-pathway.model");
const PublicDiagnosticAttemptModel = require("../public-site/public-diagnostic-attempt.model");

// A visitor who takes a bootcamp diagnostic and wants to enroll no longer just sends a lead for
// a human to follow up on — this module auto-provisions a REAL learner account immediately
// (see submitBootcampEnrollment), enrolled straight into the bootcamp's own hub/class, gated by
// payment: `accountStatus: "pending_payment"` at creation (blockIfSuspended refuses every write
// until an admin records a cash payment via markLeadPaid, which flips it to "active"). The
// account's login is the LEARNER'S OWN username/password, chosen on the enrollment form (same
// "learner's own dedicated login" mechanism as learner.controller.js's learnerPassword — see
// auth.service.js's setOrCreatePasswordByUsername) — deliberately distinct from the parent's own
// personal email, which is only ever used as the lead's contact/follow-up channel, same as every
// other lead.
//
// The parent gets a login of their own too (email + the password they chose), as Home Learning and
// Tech Club sign-ups do: a parent login sees every child whose guardianEmail is theirs. A family
// that already has a Digifunzi login under that email signs the new child up with that login's
// password instead — the child joins that account (see auth/parent-login.js).
//
// Deliberately its own module (not folded into leads or learners) since it orchestrates all
// three of those plus billing — same reasoning hub-visits was kept separate from billing.

function notFound(message) {
  const err = new Error(message);
  err.statusCode = 404;
  return err;
}
function badRequest(message) {
  const err = new Error(message);
  err.statusCode = 400;
  return err;
}

function money(value) {
  return Number(Number(value || 0).toFixed(2));
}

async function nextInvoiceNumber(trx) {
  const year = new Date().getFullYear();
  return `INV-${year}-${String(await BillingModel.nextNumber("invoice", year, trx)).padStart(6, "0")}`;
}

// A bootcamp may run at more than one hub (bootcamp_hubs) — when the visitor picked one
// (hubId, from the enroll form's hub step, shown whenever a bootcamp has more than one
// offering), enroll them into that exact offering. Otherwise fall back to the earliest-created
// offering that actually resolved to real classes, same as the original single-hub behaviour —
// a bootcamp with zero offerings yet (an admin hasn't run "createOffering" for it) can't enroll
// anyone until that's done.
async function resolveBootcampOffering(bootcampIdOrSlug, hubId) {
  const bootcamp = await resolveForSaleBootcamp(bootcampIdOrSlug);
  if (!bootcamp) throw notFound("Bootcamp not found");
  const offerings = (await BootcampHubModel.findByBootcampId(bootcamp.id))
    .filter((o) => Array.isArray(o.classIds) && o.classIds.length > 0);

  let offering;
  if (hubId) {
    offering = offerings.find((o) => o.hubId === hubId);
    if (!offering) throw badRequest("That hub isn't available for this bootcamp — pick another.");
  } else {
    offering = offerings.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))[0];
  }
  if (!offering) {
    throw badRequest("This bootcamp isn't set up to enroll learners yet — contact the school.");
  }
  return { bootcamp, offering };
}

function splitName(fullName) {
  const parts = String(fullName || "").trim().split(/\s+/).filter(Boolean);
  return { firstName: parts[0] || "Learner", lastName: parts.slice(1).join(" ") || "" };
}

const BootcampEnrollmentService = {
  resolveBootcampOffering,

  // POST /api/public/bootcamp-enrollments — the single entry point the website's new
  // BootcampEnrollForm calls. Creates the lead (for staff visibility/continuity with the
  // existing Enquiries page), then the learner + login + enrollment. Learner-create and
  // enroll must succeed together — a half-created, unenrolled learner is a genuinely broken
  // state, so a failure after the learner is created rolls it back before rethrowing, unlike the
  // lead-notification/acknowledgement-email side effects elsewhere in this app which already
  // tolerate failure.
  async submitBootcampEnrollment(data, visitSource = null) {
    const { bootcamp, offering } = await resolveBootcampOffering(data.bootcampIdOrSlug, data.hubId);
    const classId = offering.classIds[0];

    const existingParent = await parentLoginFor(data.parentEmail, data.parentPassword);

    const bootcampSlug = slugify(bootcamp.name) || "bootcamp";
    const lead = await LeadModel.create({
      source: "enroll",
      name: data.parentName,
      email: data.parentEmail,
      phone: data.parentPhone,
      learnerName: data.learnerName,
      learnerAge: ageFrom(data.learnerDateOfBirth) ?? data.learnerAge,
      learnerDateOfBirth: data.learnerDateOfBirth || null,
      interestedIn: "bootcamp",
      referenceId: bootcampSlug,
      message: data.attemptId ? `Diagnostic attempt: ${data.attemptId}` : null,
      bootcampId: bootcamp.id,
      hubId: offering.hubId,
      visitSource,
    });
    await LeadService._notifyAdmins(lead);

    const { firstName, lastName } = splitName(data.learnerName);

    // The learner record's own username-uniqueness check (assertUsernameAvailable, inside
    // createLearner) has to throw first — same ordering as learner.controller.js's createLearner:
    // a colliding username must fail before any login is minted for it, so a typo'd/taken
    // username can never silently reset a different learner's own login.
    let learner;
    let createdParentId = null;
    try {
      learner = await LearnerService.createLearner({
        firstName,
        lastName,
        gender: null, // the bootcamp form doesn't ask; male or female is set on the learner later
        dateOfBirth: data.learnerDateOfBirth || "",
        guardianName: data.parentName,
        guardianPhone: data.parentPhone,
        guardianEmail: data.parentEmail,
        username: data.username,
        accountStatus: "pending_payment",
      });
      await AuthService.setOrCreatePasswordByUsername({
        name: data.learnerName,
        username: data.username,
        password: data.password,
        role: "learner",
      });
      await LearnerService.enrollInHub(learner.id, { hubId: offering.hubId, classId, status: "active" });
      // The parent's login: a new one, or the family's existing one — which takes the parent role
      // if it signs in as something else (an educator who is also a parent; account-roles.js).
      if (!existingParent) {
        const parent = await AuthService.createUser({ name: data.parentName, email: data.parentEmail, password: data.parentPassword, role: "learner" });
        createdParentId = parent.id;
      } else if (existingParent.role !== "learner") {
        await AuthService.linkExistingLogin(data.parentEmail, "learner");
      }
    } catch (err) {
      if (learner) await LearnerService.deleteLearner(learner.id).catch(() => {});
      if (createdParentId) await UserModel.delete(createdParentId).catch(() => {});
      throw err;
    }

    // Their stage and pathway, so the profile shows them from day one. Never fails the enrolment.
    await placeOnBootcampPathway(learner.id, bootcamp, offering.hubId, { attemptId: data.attemptId, age: ageFrom(data.learnerDateOfBirth) ?? data.learnerAge })
      .catch((err) => console.error("[bootcamp-enrollment] could not place the learner on a pathway:", err.message));

    // The confirmation screen shows "pay KES X at <hub>" — the price/hub the visitor needs to
    // complete the payment. A bootcamp priced by course/module (not a single whole-bootcamp
    // priceAmount) has no one number until resolveEffectiveBootcampPrice sums whichever mode is
    // actually in use — enrollment always signs the learner up for the whole bootcamp, never one
    // course, so a single total is what's actually owed regardless of pricing mode.
    const hub = await LearningHubModel.findById(offering.hubId);
    const price = resolveEffectiveBootcampPrice(bootcamp);

    // The invoice is raised now (as Home Learning and Tech Club sign-ups do), so the family can pay
    // it by M-Pesa from the "payment pending" screen; paying it in full switches the learner on
    // (activateForPaidInvoice). Staff can still take cash and press "Mark paid".
    let invoice = null;
    if (Number(price.amount) > 0) {
      invoice = await raiseEnrollmentInvoice({ lead, learnerId: learner.id, hubId: offering.hubId, bootcamp, amount: money(price.amount), currency: price.currency || "KES" })
        .catch((err) => { console.error("[bootcamp-enrollment] could not raise the enrolment invoice:", err.message); return null; });
    }
    await LeadModel.update(lead.id, { learnerId: learner.id, invoiceId: invoice?.id || null });
    // The parent gets it by email too, with how to pay it (see billing.emails.js).
    if (invoice) require("../billing/billing.service").emailIssuedInvoice(invoice.id);

    return {
      lead: { ...lead, learnerId: learner.id, invoiceId: invoice?.id || null },
      // The visitor already knows their own username/password (they just typed them) — nothing
      // new to show them here, unlike the old auto-generated-credential flow.
      learnerUsername: data.username,
      // The parent signs in with their email: a login made just now, or the one they already had.
      parentAccount: { email: data.parentEmail, existing: Boolean(existingParent) },
      payment: {
        amount: price.amount,
        currency: price.currency,
        mode: price.mode,
        hubName: hub?.name || null,
        invoiceNumber: invoice?.invoiceNumber || null,
        // Pay now by M-Pesa, without signing in (null when M-Pesa is off or there's no invoice).
        pay: invoice ? await PaymentLinks.forWebsite(invoice, "bootcamp_enrollment") : null,
      },
    };
  },

  // POST /api/leads/:id/mark-paid — an admin recording a cash payment against a bootcamp
  // enrollment lead. Writes a real billing_invoices/billing_invoice_items/billing_payments row
  // set directly via BillingModel (bypassing BillingService.createInvoice's generic manual-entry
  // validation, same precedent hub-visit.service.js's generateCharges already established for a
  // system-generated, already-fully-paid invoice), then unlocks the learner's access — all in
  // one transaction so the lead's cache fields, the real billing rows, and the learner's
  // accountStatus can never drift apart.
  async markLeadPaid(leadId, data, actorUserId) {
    const lead = await LeadModel.findById(leadId);
    if (!lead) throw notFound("Lead not found");
    if (lead.paidAt) throw badRequest("This enquiry has already been marked paid.");
    if (!lead.learnerId || !lead.hubId) {
      throw badRequest("This enquiry has no provisioned learner to mark paid.");
    }

    const amount = money(data.amount);

    // An enrolment made since invoices are raised at sign-up: the cash goes on that invoice.
    const enrollmentInvoice = lead.invoiceId ? await BillingModel.findInvoiceById(lead.invoiceId) : null;
    if (enrollmentInvoice && PAYABLE.includes(enrollmentInvoice.status)) {
      // Required here, not at the top: billing.service.js reaches this module through its
      // invoice-paid hooks.
      const BillingService = require("../billing/billing.service");
      const { invoice } = await BillingService.applyPayment(enrollmentInvoice.id, {
        amount, provider: "manual", paymentMethod: "cash", recordedBy: actorUserId,
        idempotencyKey: `bootcamp-lead-${lead.id}`, notes: data.description || "Bootcamp enrolment",
      });
      // Paid in full, the payment has already switched the learner on; a part payment the admin
      // accepts does it here.
      const learner = await activateLead(lead.id, { amount, currency: invoice.currency, paidByUserId: actorUserId, invoice });
      return { invoice, learner };
    }

    const bootcamp = lead.bootcampId ? await BootcampModel.findById(lead.bootcampId) : null;
    const description = data.description || `${bootcamp?.name || "Bootcamp"} — cash payment`;
    const now = new Date();

    let invoice;
    await BillingModel.transaction(async (trx) => {
      invoice = await BillingModel.createInvoice({
        invoiceNumber: await nextInvoiceNumber(trx),
        issuerType: "learning_hub",
        issuerHubId: lead.hubId,
        payerUserId: null,
        payerHubId: null,
        learnerId: lead.learnerId,
        hubId: lead.hubId,
        invoiceType: "bootcamp",
        status: "issued",
        currency: data.currency || "KES",
        subtotal: amount,
        discount: 0,
        total: amount,
        amountPaid: amount,
        issuedAt: now,
        paidAt: now,
        notes: null,
      }, trx);
      await BillingModel.createItem({
        invoiceId: invoice.id,
        learnerId: lead.learnerId,
        courseId: null,
        description,
        quantity: 1,
        unitAmount: amount,
        totalAmount: amount,
        metadata: { leadId: lead.id, bootcampId: lead.bootcampId || null },
      }, trx);
      await BillingModel.createPayment({
        invoiceId: invoice.id,
        payerUserId: null,
        provider: "manual",
        paymentMethod: "cash",
        amount,
        currency: data.currency || "KES",
        status: "successful",
        paidAt: now,
      }, trx);
      await BillingModel.createAuditEvent({ invoiceId: invoice.id, actorUserId, eventType: "invoice_issued", newStatus: "issued", amount, metadata: { source: "bootcamp_enrollment" } }, trx);
      await LeadModel.update(lead.id, { paidAmount: amount, paidCurrency: data.currency || "KES", paidAt: now, paidByUserId: actorUserId });
    });

    const learner = await LearnerModel.update(lead.learnerId, { accountStatus: "active" });
    // The invoice's "guardian" IS the auto-provisioned login itself (guardianEmail ===
    // loginEmail) — notifyLearner already resolves that account (and any dedicated learner-own
    // login) the same way every other learner notification does, no special-casing needed.
    await NotificationService.notifyLearner(lead.learnerId, {
      type: "invoice_issued",
      title: "New invoice issued",
      message: `Your payment of ${data.currency || "KES"} ${amount} has been recorded. Your account is now fully active.`,
      payload: { invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber, route: "/learner-portal/invoices/" },
      dedupeKey: `invoice_issued:${invoice.id}`,
    }).catch(() => {});

    return { invoice, learner };
  },

  // A bootcamp enrolment's invoice was paid in full (by M-Pesa, or recorded in Billing) — switch
  // the learner on, as "Mark paid" does. Does nothing for any other invoice.
  async activateForPaidInvoice(invoice, { amount, paidByUserId }) {
    if (invoice.invoiceType !== "bootcamp") return;
    const lead = await LeadModel.findByInvoiceId(invoice.id);
    if (!lead || lead.paidAt) return;
    await activateLead(lead.id, { amount: amount ?? Number(invoice.total), currency: invoice.currency, paidByUserId, invoice });
    const [bootcamp, hub] = await Promise.all([
      lead.bootcampId ? BootcampModel.findById(lead.bootcampId) : null,
      LearningHubModel.findById(lead.hubId),
    ]);
    // Staff who recorded the payment themselves don't need telling.
    if (hub?.ownerAdminId && !paidByUserId) {
      await NotificationService._notify(hub.ownerAdminId, {
        type: "bootcamp_enrollment_paid",
        title: "Bootcamp enrolment paid",
        message: `${lead.learnerName || "A learner"} (${lead.name}) paid invoice ${invoice.invoiceNumber} for ${bootcamp?.name || "a bootcamp"}, so their account is now active.`,
        payload: { route: `/enquiries?lead=${lead.id}` },
        dedupeKey: `bootcamp_enrollment_paid:${lead.id}`,
        ownerAdminId: hub.ownerAdminId,
      }).catch(() => {});
    }
  },
};

const PAYABLE = ["issued", "partially_paid", "overdue"];

// The enrolment's invoice, issued to the family at sign-up — the bootcamp at the hub the learner
// was enrolled into. Written through BillingModel directly, like hub-visit charges: the generic
// createInvoice route is for staff typing an invoice in.
// A website bootcamp enrolment's learner onto the bootcamp's pathway (every stage of its picked
// pathways — pathwayRowsFor):
//   - the one whose website diagnostic they just took (attemptId), at the course their score earns
//     (the curriculum's ladder, resolvePlacementFromScore — the same as a learner diagnostic);
//   - otherwise the one for their stage at this hub, or for their age, at its first course.
// Their stage at the hub is set from that pathway when it isn't set yet (enrollInHub already sets
// it from the date of birth when there is one). Nothing happens when no pathway fits.
async function placeOnBootcampPathway(learnerId, bootcamp, hubId, { attemptId = null, age = null } = {}) {
  if (!bootcamp?.curriculumId) return null;
  const CompetencyService = require("../curriculum/competency-framework/competency.service");
  const AgeCategoryModel = require("../curriculum/competency-framework/age-category.model");
  const curriculumId = bootcamp.curriculumId;
  const rows = await pathwayRowsFor(curriculumId, Array.isArray(bootcamp.pathwayIds) ? bootcamp.pathwayIds : []);
  if (rows.length === 0) return null;
  const link = await LearnerHubLinkModel.findOne(learnerId, hubId);

  let pathway = null;
  let scorePercent = null;
  let assessmentId = null;
  const attempt = attemptId ? await PublicDiagnosticAttemptModel.findById(attemptId).catch(() => null) : null;
  if (attempt) {
    pathway = rows.find((r) => r.id === attempt.pathwayId) || null;
    if (pathway) {
      scorePercent = Number(attempt.maxScore) > 0 ? (Number(attempt.totalScore) / Number(attempt.maxScore)) * 100 : 0;
      assessmentId = attempt.assessmentId || null;
    }
  }
  if (!pathway && link?.currentStageId) pathway = rows.find((r) => r.ageCategoryId === link.currentStageId) || null;
  if (!pathway && age != null) {
    for (const row of rows) {
      const stage = row.ageCategoryId ? await AgeCategoryModel.findById(row.ageCategoryId) : null;
      if (stage?.minAge != null && stage?.maxAge != null && age >= stage.minAge && age <= stage.maxAge) { pathway = row; break; }
    }
  }
  if (!pathway) return null;

  if (link && !link.currentStageId && pathway.ageCategoryId) {
    await LearnerHubLinkModel.update(link.id, { currentStageId: pathway.ageCategoryId });
  }
  if (await LearnerPathwayModel.findOne(learnerId, pathway.id)) return pathway;
  const fromScore = scorePercent != null ? await CompetencyService.resolvePlacementFromScore(curriculumId, pathway.id, scorePercent) : null;
  const courseId = fromScore || (await CompetencyService.orderedPathwayCourseIds(curriculumId, pathway))[0];
  if (!courseId) return pathway; // a pathway with no courses yet — the stage still shows it
  await LearnerPathwayModel.place(learnerId, curriculumId, pathway.id, courseId, scorePercent != null ? "diagnostic" : "enrolled", assessmentId, "auto");
  return pathway;
}

async function raiseEnrollmentInvoice({ lead, learnerId, hubId, bootcamp, amount, currency }) {
  const now = new Date();
  let invoice;
  await BillingModel.transaction(async (trx) => {
    invoice = await BillingModel.createInvoice({
      invoiceNumber: await nextInvoiceNumber(trx),
      issuerType: "learning_hub", issuerHubId: hubId, payerUserId: null, payerHubId: null,
      learnerId, hubId, invoiceType: "bootcamp", status: "issued", currency,
      subtotal: amount, discount: 0, total: amount, amountPaid: 0, issuedAt: now, notes: null,
    }, trx);
    await BillingModel.createItem({
      invoiceId: invoice.id, learnerId, courseId: null, description: `${bootcamp.name} — enrolment`,
      quantity: 1, unitAmount: amount, totalAmount: amount, metadata: { leadId: lead.id, bootcampId: bootcamp.id },
    }, trx);
    await BillingModel.createAuditEvent({ invoiceId: invoice.id, actorUserId: null, eventType: "invoice_issued", newStatus: "issued", amount, metadata: { source: "bootcamp_enrollment" } }, trx);
  });
  return invoice;
}

// A paid enrolment: the enquiry is stamped paid and the learner's login unlocks. Safe to run
// twice — an enquiry already stamped paid is left alone. Returns the learner.
async function activateLead(leadId, { amount, currency, paidByUserId = null, invoice }) {
  const lead = await LeadModel.findById(leadId);
  if (!lead) return null;
  if (lead.paidAt) return LearnerModel.findById(lead.learnerId);
  await LeadModel.update(lead.id, { paidAmount: amount, paidCurrency: currency || "KES", paidAt: new Date(), paidByUserId });
  const learner = await LearnerModel.update(lead.learnerId, { accountStatus: "active" });
  await NotificationService.notifyLearner(lead.learnerId, {
    type: "account_activated",
    title: "Your account is active",
    message: `Your payment of ${currency || "KES"} ${amount} has been recorded. Your account is now fully active.`,
    payload: { invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber, route: "/learner-portal" },
    dedupeKey: `bootcamp_activated:${lead.learnerId}`,
  }).catch(() => {});
  return learner;
}

module.exports = BootcampEnrollmentService;
module.exports.placeOnBootcampPathway = placeOnBootcampPathway;
