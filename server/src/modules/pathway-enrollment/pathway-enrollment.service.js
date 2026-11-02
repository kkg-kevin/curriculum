const LeadModel = require("../leads/lead.model");
const LeadService = require("../leads/lead.service");
const LearnerService = require("../learners/learner.service");
const LearnerModel = require("../learners/learner.model");
const LearnerHubLinkModel = require("../learners/learner-hub-link.model");
const LearnerPathwayModel = require("../curriculum/competency-framework/learner-pathway.model");
const AuthService = require("../auth/auth.service");
const UserModel = require("../auth/user.model");
const LearningHubModel = require("../learning-hubs/learning-hub.model");
const BillingModel = require("../billing/billing.model");
const NotificationService = require("../notifications/notification.service");
const PaymentLinks = require("../payments/payment-links");
const PublicDiagnosticAttemptModel = require("../public-site/public-diagnostic-attempt.model");
const { parentLoginFor } = require("../auth/parent-login");
const { issueParentToken } = require("../auth/parent-signup");
const { resolveForEnrolment } = require("../public-site/public-site.service");
const { coursePrice, isPriced } = require("../../shared/utils/pathway-pricing");
const { ageFrom, kenyaToday } = require("../../shared/utils/age");
const { enrolmentHelpers } = require("../bootcamp-enrollment/bootcamp-enrollment.service");

const { activateLead, assertUsernameFree, splitName, nextInvoiceNumber, money } = enrolmentHelpers;

// A pathway enrolment on the website: a priced pathway (Settings → Pathways → On the website →
// Price) that runs at chosen hubs. The family picks a hub, then signs up one or more children the
// same way a bootcamp enrolment does (bootcamp-enrollment/): a parent login (or the existing one,
// by password or parent token), each child's own username login, an enquiry per child — and
// here, each child linked to the chosen hub WITHOUT a class (staff choose it), at the pathway's
// stage for their age (or their website diagnostic), on the pathway at their starting course.
// One invoice covers the family: per child, the whole pathway's price, or their starting course's
// price; paying it switches every child on (activateForPaidInvoice). Accounts wait as
// pending_payment until then, like a bootcamp's.

function badRequest(message) {
  return Object.assign(new Error(message), { statusCode: 400 });
}

// Where a child starts: their website diagnostic's pathway row and the course their score earns,
// else the stage for their age and its first course. Throws when the pathway isn't offered for
// their age.
async function startingPoint(pathway, child) {
  const CompetencyService = require("../curriculum/competency-framework/competency.service");
  const age = ageFrom(child.learnerDateOfBirth) ?? child.learnerAge;
  const stages = pathway.resolved.stages;
  let stage = null;
  let scorePercent = null;
  let assessmentId = null;
  const attempt = child.attemptId ? await PublicDiagnosticAttemptModel.findById(child.attemptId).catch(() => null) : null;
  if (attempt) {
    stage = stages.find((s) => s.row.id === attempt.pathwayId) || null;
    if (stage) {
      scorePercent = Number(attempt.maxScore) > 0 ? (Number(attempt.totalScore) / Number(attempt.maxScore)) * 100 : 0;
      assessmentId = attempt.assessmentId || null;
    }
  }
  if (!stage && age != null) {
    stage = stages.find((s) => s.stage && s.stage.minAge != null && s.stage.maxAge != null && age >= s.stage.minAge && age <= s.stage.maxAge) || null;
  }
  if (!stage && stages.length === 1 && !stages[0].stage) stage = stages[0]; // a pathway with no stages
  if (!stage) throw badRequest(`${pathway.name} isn't offered for ${child.learnerName}'s age (${age ?? "unknown"}) — enquire instead and our team will help.`);
  let course = stage.courses[0];
  if (scorePercent != null) {
    const placed = await CompetencyService.resolvePlacementFromScore(stage.row.curriculumId, stage.row.id, scorePercent).catch(() => null);
    course = stage.courses.find((c) => c.id === placed) || course;
  }
  return { age, stage, course, scorePercent, assessmentId };
}

const PathwayEnrollmentService = {
  // POST /api/public/pathway-enrollments.
  async submit(data, visitSource = null) {
    const pathway = await resolveForEnrolment(data.pathwayIdOrSlug);
    if (!pathway) throw Object.assign(new Error("Pathway not found"), { statusCode: 404 });
    const { pricing, hubIds } = pathway.website;
    if (!isPriced(pricing)) throw badRequest("This pathway isn't open for online enrolment — enquire instead.");
    if (!hubIds.includes(data.hubId)) throw badRequest("Choose one of the hubs this pathway runs at.");
    const hub = await LearningHubModel.findById(data.hubId);
    if (!hub || hub.status !== "active") throw badRequest("That hub isn't taking enrolments — choose another.");

    // Everything is checked before anything is written: each child's starting point and price,
    // their usernames, the parent's login.
    const children = data.children.map((c, i) => ({ ...c, attemptId: c.attemptId || (i === 0 ? data.attemptId : null) || null }));
    const plans = [];
    for (const child of children) {
      const start = await startingPoint(pathway, child);
      const amount = pricing.mode === "whole" ? pricing.amount : coursePrice(pricing, start.course.id);
      if (amount == null) throw badRequest(`${start.course.name}, where ${child.learnerName} would start, has no price yet — enquire instead and our team will help.`);
      plans.push({ child, ...start, amount: money(amount) });
    }
    const existingParent = await parentLoginFor(data.parentEmail, data.parentPassword, data.parentToken);
    if (!existingParent && !data.parentPassword) throw badRequest("Choose a password for your account.");
    for (const child of children) await assertUsernameFree(child.username);

    const enrolled = [];
    let parentUser = existingParent;
    let createdParentId = null;
    try {
      for (const plan of plans) {
        const { child, stage, course, age } = plan;
        const lead = await LeadModel.create({
          source: "enroll", name: data.parentName, email: data.parentEmail, phone: data.parentPhone,
          learnerName: child.learnerName, learnerAge: age, learnerDateOfBirth: child.learnerDateOfBirth || null,
          interestedIn: "general", referenceId: pathway.slug, hubId: hub.id,
          message: [`Pathway enrolment: ${pathway.name}${stage.stage ? ` — ${stage.stage.name}` : ""}, starting at ${course.name}.`, child.attemptId ? `Diagnostic attempt: ${child.attemptId}` : null].filter(Boolean).join("\n"),
          visitSource,
        });
        const entry = { ...plan, lead, learner: null };
        enrolled.push(entry);
        await LeadService._notifyAdmins(lead);

        const { firstName, lastName } = splitName(child.learnerName);
        entry.learner = await LearnerService.createLearner({
          firstName, lastName, gender: null,
          dateOfBirth: child.learnerDateOfBirth || "",
          ...(child.learnerDateOfBirth ? {} : { statedAge: child.learnerAge, statedAgeOn: kenyaToday() }),
          guardianName: data.parentName, guardianPhone: data.parentPhone, guardianEmail: data.parentEmail,
          username: child.username, accountStatus: "pending_payment",
        });
        await AuthService.setOrCreatePasswordByUsername({ name: child.learnerName, username: child.username, password: child.password, role: "learner" });
        // At the hub without a class — staff put them in one.
        await LearnerService.enrollInHub(entry.learner.id, { hubId: hub.id, status: "active", autoClass: false });
      }
      if (!existingParent) {
        parentUser = await AuthService.createUser({ name: data.parentName, email: data.parentEmail, password: data.parentPassword, role: "learner" });
        createdParentId = parentUser.id;
      } else if (existingParent.role !== "learner") {
        await AuthService.linkExistingLogin(data.parentEmail, "learner");
      }
    } catch (err) {
      for (const entry of enrolled) {
        if (!entry.learner) continue;
        await LearnerService.deleteLearner(entry.learner.id).catch(() => {});
        const login = await UserModel.findByUsername(entry.child.username).catch(() => null);
        if (login) await UserModel.delete(login.id).catch(() => {});
      }
      if (createdParentId) await UserModel.delete(createdParentId).catch(() => {});
      throw err;
    }

    // Each child's stage at the hub and place on the pathway; their website diagnostic joins their
    // record. Never fails the enrolment.
    for (const { child, learner, stage, course, scorePercent, assessmentId } of enrolled) {
      try {
        const link = await LearnerHubLinkModel.findOne(learner.id, hub.id);
        if (link && stage.row.ageCategoryId) {
          await LearnerHubLinkModel.update(link.id, { currentStageId: stage.row.ageCategoryId, stageSource: scorePercent != null ? "diagnostic" : "age" });
        }
        await LearnerPathwayModel.place(learner.id, stage.row.curriculumId, stage.row.id, course.id, scorePercent != null ? "diagnostic" : "enrolled", assessmentId, "auto");
        if (child.attemptId) await require("../assessments/submissions/website-diagnostic.service").record(learner.id, child.attemptId);
      } catch (err) {
        console.error("[pathway-enrollment] could not place the learner:", err.message);
      }
    }

    const currency = pricing.currency || "KES";
    const total = money(enrolled.reduce((sum, e) => sum + e.amount, 0));
    let invoice = null;
    if (total > 0) {
      invoice = await raiseInvoice({ enrolled, hub, pathway, currency, total })
        .catch((err) => { console.error("[pathway-enrollment] could not raise the invoice:", err.message); return null; });
    }
    for (const { lead, learner } of enrolled) await LeadModel.update(lead.id, { learnerId: learner.id, invoiceId: invoice?.id || null });
    if (invoice) require("../billing/billing.service").emailIssuedInvoice(invoice.id);

    return {
      learners: enrolled.map(({ child, course, stage, amount }) => ({
        name: child.learnerName, username: child.username, startsAt: course.name, stage: stage.stage?.name || null, amount,
      })),
      parentAccount: { email: data.parentEmail, existing: Boolean(existingParent), name: data.parentName, phone: data.parentPhone },
      parentToken: parentUser ? issueParentToken(parentUser) : null,
      hub: { id: hub.id, name: hub.name },
      payment: {
        amount: total, currency, mode: pricing.mode, children: enrolled.length,
        invoiceNumber: invoice?.invoiceNumber || null,
        pay: invoice ? await PaymentLinks.forWebsite(invoice, "pathway_enrollment") : null,
      },
    };
  },

  // A pathway enrolment's invoice was paid (enough of it — billing.paid-hooks.js): every child it
  // signed up is switched on, as a bootcamp enrolment's are. Does nothing for any other invoice.
  async activateForPaidInvoice(invoice, { amount, paidByUserId }) {
    if (invoice.invoiceType !== "pathway") return;
    const leads = (await LeadModel.findAllByInvoiceId(invoice.id)).filter((l) => !l.paidAt && l.learnerId);
    if (leads.length === 0) return;
    const share = money((amount ?? Number(invoice.total)) / leads.length);
    for (const lead of leads) await activateLead(lead.id, { amount: share, currency: invoice.currency, paidByUserId, invoice });
    const hub = leads[0].hubId ? await LearningHubModel.findById(leads[0].hubId) : null;
    if (hub?.ownerAdminId && !paidByUserId) {
      await NotificationService._notify(hub.ownerAdminId, {
        type: "bootcamp_enrollment_paid",
        title: "Pathway enrolment paid",
        message: `${leads.map((l) => l.learnerName || "A learner").join(", ")} (${leads[0].name}) paid invoice ${invoice.invoiceNumber} for ${leads[0].referenceId || "a pathway"} at ${hub.name} — they need a class.`,
        payload: { route: `/enquiries?lead=${leads[0].id}` },
        dedupeKey: `pathway_enrollment_paid:${invoice.id}`,
        ownerAdminId: hub.ownerAdminId,
      }).catch(() => {});
    }
  },
};

// The family's invoice: a line per child (their whole-pathway price or starting course's), issued
// by the chosen hub; its learnerId is the first child's (billing.access.js pauses every line's).
async function raiseInvoice({ enrolled, hub, pathway, currency, total }) {
  const now = new Date();
  let invoice;
  await BillingModel.transaction(async (trx) => {
    invoice = await BillingModel.createInvoice({
      invoiceNumber: await nextInvoiceNumber(trx),
      issuerType: "learning_hub", issuerHubId: hub.id, payerUserId: null, payerHubId: null,
      learnerId: enrolled[0].learner.id, hubId: hub.id, invoiceType: "pathway", status: "issued", currency,
      subtotal: total, discount: 0, total, amountPaid: 0, issuedAt: now, notes: null,
    }, trx);
    for (const { child, lead, learner, course, stage, amount } of enrolled) {
      if (!(amount > 0)) continue;
      await BillingModel.createItem({
        invoiceId: invoice.id, learnerId: learner.id, courseId: course.id,
        description: `${pathway.name} — ${pathway.website.pricing.mode === "whole" ? "the pathway" : course.name}${enrolled.length > 1 ? ` (${child.learnerName})` : ""}`,
        quantity: 1, unitAmount: amount, totalAmount: amount,
        metadata: { leadId: lead.id, pathwayId: stage.row.id, courseId: course.id },
      }, trx);
    }
    await BillingModel.createAuditEvent({ invoiceId: invoice.id, actorUserId: null, eventType: "invoice_issued", newStatus: "issued", amount: total, metadata: { source: "pathway_enrollment" } }, trx);
  });
  return invoice;
}

module.exports = PathwayEnrollmentService;
