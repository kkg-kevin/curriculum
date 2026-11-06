const LeadModel = require("../leads/lead.model");
const LeadService = require("../leads/lead.service");
const LearnerService = require("../learners/learner.service");
const LearnerModel = require("../learners/learner.model");
const LearnerHubLinkModel = require("../learners/learner-hub-link.model");
const LearnerPathwayModel = require("../curriculum/competency-framework/learner-pathway.model");
const AuthService = require("../auth/auth.service");
const UserModel = require("../auth/user.model");
const LearningHubModel = require("../learning-hubs/learning-hub.model");
const NotificationService = require("../notifications/notification.service");
const PaymentLinks = require("../payments/payment-links");
const PublicDiagnosticAttemptModel = require("../public-site/public-diagnostic-attempt.model");
const { parentLoginFor } = require("../auth/parent-login");
const { issueParentToken } = require("../auth/parent-signup");
const { resolveForEnrolment } = require("../public-site/public-site.service");
const { ageFrom, kenyaToday } = require("../../shared/utils/age");
const { enrolmentHelpers } = require("../bootcamp-enrollment/bootcamp-enrollment.service");
const PathwaySubscriptionService = require("../pathway-subscriptions/pathway-subscription.service");

const { activateLead, assertUsernameFree, splitName, money } = enrolmentHelpers;

// A pathway subscription on the website: one of a pathway's plans (Billing → Packages → Pathway
// plans) at one of the hubs it runs at. The family picks the plan and a hub, then signs up one or
// more children the same way a bootcamp enrolment does (bootcamp-enrollment/): a parent login (or
// the existing one, by password or parent token), each child's own username login, an enquiry per
// child — each child linked to the hub WITHOUT a class (a class is optional), at the pathway's stage
// for their age (or their website diagnostic), on the pathway at their starting course. Then the
// subscription and its first period's invoice (startSubscription); paying it opens the pathway's
// courses (pathway-subscriptions/). The accounts are open from the start.
// The one-off price (Settings → Pathways → Price) was removed on 4 Nov 2026; invoices it raised
// before then still switch their children on when paid (activateForPaidInvoice).

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
    const { hubIds } = pathway.website;
    // A pathway is sold by its subscription plans (Billing → Packages → Pathway plans) — the
    // one-off Settings price was removed on 4 Nov 2026. No plan chosen: it isn't sold online.
    if (!data.packageId) throw badRequest("Choose a plan to enrol — or enquire and our team will help.");
    const plan = await resolvePlan(pathway, data.packageId);
    // The period chosen on the plan card (6 Nov 2026); left out, the plan's default.
    const wantedPeriod = ["weekly", "monthly", "quarterly", "annually"].includes(data.billingPeriod) ? data.billingPeriod : null;
    if (wantedPeriod && !PathwaySubscriptionService.priceFor(plan, plan.childrenIncluded, wantedPeriod)) throw badRequest(`${plan.name} isn't offered for that period — please choose another option.`);
    const planPrice = PathwaySubscriptionService.priceFor(plan, data.children.length, wantedPeriod);
    if (!planPrice) {
      throw badRequest(plan.allowExtraChildren ? `${plan.name} takes up to ${plan.maxChildren} children` : `${plan.name} covers ${plan.childrenIncluded === 1 ? "1 child" : `${plan.childrenIncluded} children`} — choose a larger plan for more`);
    }
    if (!hubIds.includes(data.hubId)) throw badRequest("Choose one of the hubs this pathway runs at.");
    const hub = await LearningHubModel.findById(data.hubId);
    if (!hub || hub.status !== "active") throw badRequest("That hub isn't taking enrolments — choose another.");

    // Everything is checked before anything is written: each child's starting point and price,
    // their usernames, the parent's login.
    const children = data.children.map((c, i) => ({ ...c, attemptId: c.attemptId || (i === 0 ? data.attemptId : null) || null }));
    const plans = [];
    for (const child of children) {
      const start = await startingPoint(pathway, child);
      // The subscription is priced as a whole (planPrice), not per child.
      plans.push({ child, ...start });
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
          // The account is open; the pathway's courses wait on the payment (pathway-access.js).
          username: child.username, accountStatus: "active",
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

    const currency = plan.currency || "KES";
    const total = money(planPrice.amount);
    let invoice = null;
    let subscription = null;
    try {
      ({ subscription, invoice } = await startSubscription({ plan, planPrice, pathway, hub, data, enrolled }));
    } catch (err) {
      console.error("[pathway-enrollment] could not start the subscription:", err.message);
    }
    for (const { lead, learner } of enrolled) await LeadModel.update(lead.id, { learnerId: learner.id, invoiceId: invoice?.id || null });
    // Credited to an affiliate's link or code, if any (never fails the enrolment).
    if (subscription) {
      await require("../affiliates/affiliate.service").recordReferral({
        ownerAdminId: plan.ownerAdminId, programme: "pathway", recordId: subscription.id, invoiceId: invoice?.id || null,
        code: data.referralCode, visitSource, detail: `${pathway.name} · ${plan.name}`,
        parent: { userId: parentUser?.id || null, name: data.parentName, email: data.parentEmail, phone: data.parentPhone },
      });
    }

    return {
      learners: enrolled.map(({ child, course, stage }) => ({
        name: child.learnerName, username: child.username, startsAt: course.name, stage: stage.stage?.name || null,
      })),
      parentAccount: { email: data.parentEmail, existing: Boolean(existingParent), name: data.parentName, phone: data.parentPhone },
      parentToken: parentUser ? issueParentToken(parentUser) : null,
      hub: { id: hub.id, name: hub.name },
      subscription: { id: subscription?.id || null, plan: plan.name, billingPeriod: planPrice.billingPeriod, amount: Number(planPrice.amount) },
      payment: {
        amount: total, currency, mode: "subscription", children: enrolled.length,
        invoiceNumber: invoice?.invoiceNumber || null,
        pay: invoice ? await PaymentLinks.forWebsite(invoice, "pathway_subscription") : null,
      },
    };
  },

  // A one-off pathway enrolment's invoice (invoiceType "pathway" — only raised before 4 Nov 2026,
  // when one-off prices were removed) was paid (enough of it — billing.paid-hooks.js): every child
  // it signed up is switched on and gets the pathway for good. Does nothing for any other invoice.
  async activateForPaidInvoice(invoice, { amount, paidByUserId }) {
    if (invoice.invoiceType !== "pathway") return;
    const leads = (await LeadModel.findAllByInvoiceId(invoice.id)).filter((l) => !l.paidAt && l.learnerId);
    if (leads.length === 0) return;
    const share = money((amount ?? Number(invoice.total)) / leads.length);
    for (const lead of leads) await activateLead(lead.id, { amount: share, currency: invoice.currency, paidByUserId, invoice });
    await grantPurchasedAccess(invoice).catch((err) => console.error("[pathway-enrollment] could not open the pathway:", err.message));
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

// A website plan for this pathway: published, active, one of the website workspace's and sold for
// this pathway's catalogue entry.
async function resolvePlan(pathway, packageId) {
  const { PathwayPackageModel } = require("../pathway-subscriptions/pathway-subscription.model");
  const plan = await PathwayPackageModel.findById(packageId);
  const ok = plan && plan.status === "active" && plan.isPublished && plan.pathwayTemplateId && plan.pathwayTemplateId === pathway.website.templateId;
  if (!ok) throw badRequest("That plan is no longer available — please choose another.");
  return plan;
}

// The family's subscription (pending until its first invoice is paid): every child on it, at the
// stage and course they were placed at, and the first period's invoice — from today, renewing
// automatically after (billing/package-billing.js).
async function startSubscription({ plan, planPrice, pathway, hub, data, enrolled }) {
  const { PathwaySubscriptionModel } = require("../pathway-subscriptions/pathway-subscription.model");
  const { firstPeriod } = require("../billing/package-billing");
  const { dueDateFor } = require("../../shared/utils/billing-periods");
  const period = firstPeriod(planPrice.billingPeriod);
  const subscription = await PathwaySubscriptionModel.create({
    ownerAdminId: plan.ownerAdminId, packageId: plan.id, pathwayTemplateId: plan.pathwayTemplateId,
    curriculumId: enrolled[0].stage.row.curriculumId, pathwayName: pathway.name, hubId: hub.id,
    guardianName: data.parentName, guardianEmail: data.parentEmail, guardianPhone: data.parentPhone,
    childCount: planPrice.childCount, amount: planPrice.amount, billingPeriod: planPrice.billingPeriod,
    billingAnchor: period.start, billedThrough: period.end, status: "pending", source: "website",
    notes: `Signed up on the website on ${kenyaToday()}.`,
  });
  for (const { learner, stage, course } of enrolled) {
    await PathwaySubscriptionModel.addChild({ ownerAdminId: plan.ownerAdminId, subscriptionId: subscription.id, learnerId: learner.id, pathwayId: stage.row.id, startCourseId: course.id, status: "active" });
  }
  const invoice = await PathwaySubscriptionService.raiseSubscriptionInvoice(subscription, {
    periodStart: period.start, periodEnd: period.end, label: period.label, dueDate: dueDateFor(planPrice.billingPeriod, kenyaToday(), period.end),
  });
  await PathwaySubscriptionModel.update(subscription.id, { signupInvoiceId: invoice.id });
  return { subscription, invoice };
}

// A one-off pathway purchase is paid: each child on it may open the pathway's courses for good
// (pathway-subscriptions/pathway-access.js — source "purchase", no end date).
async function grantPurchasedAccess(invoice) {
  const PathwayAccess = require("../pathway-subscriptions/pathway-access");
  const db = require("../../config/db");
  const items = await db("billing_invoice_items").where({ invoiceId: invoice.id }).whereNotNull("learnerId");
  for (const item of items) {
    const meta = typeof item.metadata === "string" ? JSON.parse(item.metadata || "{}") : item.metadata || {};
    const row = meta.pathwayId ? await db("pathways").where({ id: meta.pathwayId }).first() : null;
    if (!row) continue;
    const curriculum = await db("curricula").where({ id: row.curriculumId }).first("ownerAdminId");
    const template = await db("pathway_templates").where({ ownerAdminId: curriculum?.ownerAdminId }).whereRaw("LOWER(TRIM(name)) = ?", [String(row.name).trim().toLowerCase()]).first("id");
    await PathwayAccess.grant({
      ownerAdminId: curriculum?.ownerAdminId, learnerId: item.learnerId, curriculumId: row.curriculumId, pathwayTemplateId: template?.id || null,
      pathwayName: row.name, source: "purchase", invoiceId: invoice.id,
    });
  }
}

module.exports = PathwayEnrollmentService;
