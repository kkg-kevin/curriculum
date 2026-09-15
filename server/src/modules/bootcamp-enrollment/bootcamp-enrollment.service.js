const LeadModel = require("../leads/lead.model");
const LeadService = require("../leads/lead.service");
const LearnerService = require("../learners/learner.service");
const LearnerModel = require("../learners/learner.model");
const AuthService = require("../auth/auth.service");
const BootcampModel = require("../bootcamps/bootcamp.model");
const BootcampHubModel = require("../bootcamps/bootcamp-hub.model");
const LearningHubModel = require("../learning-hubs/learning-hub.model");
const BillingModel = require("../billing/billing.model");
const NotificationService = require("../notifications/notification.service");
const { resolveForSaleBootcamp } = require("../public-site/public-bootcamp.service");
const { generateDigifunziEmail, generateTemporaryPassword } = require("../../shared/utils/credential-generator");
const { resolveEffectiveBootcampPrice } = require("../../shared/utils/bootcamp-pricing");
const { slugify } = require("../../shared/utils/slugify");

// A visitor who takes a bootcamp diagnostic and wants to enroll no longer just sends a lead for
// a human to follow up on — this module auto-provisions a REAL learner account immediately
// (see submitBootcampEnrollment), enrolled straight into the bootcamp's own hub/class, gated by
// payment: `accountStatus: "pending_payment"` at creation (blockIfSuspended refuses every write
// until an admin records a cash payment via markLeadPaid, which flips it to "active"). The
// account's login is a fresh firstname.lastname@digifunzi.com address with a one-time-shown
// temporary password — deliberately distinct from the parent's own personal email, which is
// only ever used as the lead's contact/follow-up channel, same as every other lead.
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

// A bootcamp already knows where it runs (bootcamp_hubs) - no hub-picker step for the visitor.
// Picks the earliest-created offering that actually resolved to real classes; a bootcamp with
// zero offerings yet (an admin hasn't run "createOffering" for it) can't enroll anyone until
// that's done.
async function resolveBootcampOffering(bootcampIdOrSlug) {
  const bootcamp = await resolveForSaleBootcamp(bootcampIdOrSlug);
  if (!bootcamp) throw notFound("Bootcamp not found");
  const offerings = await BootcampHubModel.findByBootcampId(bootcamp.id);
  const offering = offerings
    .filter((o) => Array.isArray(o.classIds) && o.classIds.length > 0)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))[0];
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
  async submitBootcampEnrollment(data) {
    const { bootcamp, offering } = await resolveBootcampOffering(data.bootcampIdOrSlug);
    const classId = offering.classIds[0];

    const bootcampSlug = slugify(bootcamp.name) || "bootcamp";
    const lead = await LeadModel.create({
      source: "enroll",
      name: data.parentName,
      email: data.parentEmail,
      phone: data.parentPhone,
      learnerName: data.learnerName,
      learnerAge: data.learnerAge,
      interestedIn: "bootcamp",
      referenceId: bootcampSlug,
      message: data.attemptId ? `Diagnostic attempt: ${data.attemptId}` : null,
      bootcampId: bootcamp.id,
      hubId: offering.hubId,
    });
    await LeadService._notifyAdmins(lead);

    const { firstName, lastName } = splitName(data.learnerName);
    const loginEmail = await generateDigifunziEmail(firstName, lastName);
    const tempPassword = generateTemporaryPassword();

    // Mints the login first (same order createLearner's own controller already uses for a
    // guardian password) — if the email is somehow already taken by a different-role account
    // (a freak collision right after generateDigifunziEmail's own check), nothing else is
    // written.
    await AuthService.setOrCreatePassword({ name: data.parentName, email: loginEmail, password: tempPassword, role: "learner" });

    let learner;
    try {
      learner = await LearnerService.createLearner({
        firstName,
        lastName,
        gender: "other",
        guardianName: data.parentName,
        guardianPhone: data.parentPhone,
        guardianEmail: loginEmail,
        accountStatus: "pending_payment",
      });
      await LearnerService.enrollInHub(learner.id, { hubId: offering.hubId, classId, status: "active" });
    } catch (err) {
      if (learner) await LearnerService.deleteLearner(learner.id).catch(() => {});
      throw err;
    }

    await LeadModel.update(lead.id, { learnerId: learner.id });

    // The confirmation screen shows "pay KES X in cash at <hub>" — the price/hub the visitor
    // needs to actually complete the (currently cash-only) payment, per the original "option to
    // pay depending on the set price" requirement. No payment happens here — this is purely
    // informational; the money changes hands in person and an admin records it via markLeadPaid.
    // A bootcamp priced by course/module (not a single whole-bootcamp priceAmount) has no one
    // number until resolveEffectiveBootcampPrice sums whichever mode is actually in use —
    // enrollment always signs the learner up for the whole bootcamp, never one course, so a
    // single total is what's actually owed regardless of pricing mode.
    const hub = await LearningHubModel.findById(offering.hubId);
    const price = resolveEffectiveBootcampPrice(bootcamp);
    return {
      lead: { ...lead, learnerId: learner.id },
      learnerLoginEmail: loginEmail,
      learnerTempPassword: tempPassword,
      payment: {
        amount: price.amount,
        currency: price.currency,
        mode: price.mode,
        hubName: hub?.name || null,
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

    const bootcamp = lead.bootcampId ? await BootcampModel.findById(lead.bootcampId) : null;
    const description = data.description || `${bootcamp?.name || "Bootcamp"} — cash payment`;
    const amount = money(data.amount);
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
};

module.exports = BootcampEnrollmentService;
