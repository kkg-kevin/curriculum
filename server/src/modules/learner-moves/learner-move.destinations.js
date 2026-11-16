const db = require("../../config/db");
const LearnerService = require("../learners/learner.service");
const LearnerHubLinkModel = require("../learners/learner-hub-link.model");
const LearningHubModel = require("../learning-hubs/learning-hub.model");
const ClassModel = require("../classes/class.model");
const BillingModel = require("../billing/billing.model");
const HouseholdModel = require("../home-learning/home-learning.model");
const ClubMembershipModel = require("../tech-clubs/club.model");
const LearnerPathwayModel = require("../curriculum/competency-framework/learner-pathway.model");
const { PathwayPackageModel, PathwaySubscriptionModel } = require("../pathway-subscriptions/pathway-subscription.model");
const { enrollmentSchema, householdSchema } = require("../home-learning/home-learning.validation");
const { resolveEffectiveBootcampPrice } = require("../../shared/utils/bootcamp-pricing");
const { kenyaToday } = require("../../shared/utils/age");
const { startDateProblem, addDays } = require("./learner-move.rules");
const { classLabel, fullName } = require("./learner-move.places");

// Where a learner can be moved to — one entry per programme, each opening the place through that
// programme's own code, so a moved child ends up exactly like one who joined it directly:
//   check(ctx, input)   everything validated, nothing written → a plan
//   open(ctx, plan)     the new place → { hubId, classId, recordId, label, invoice? }
//   reassert(ctx, plan, opened)  run after the places they leave are ended — a place left at the
//                       same hub shares its hub link, so the new place is put back on it
// A new household / membership / subscription is billed from `startDate` (today, or a later day
// to cover time already paid for elsewhere) by the package billing (billing/package-billing.js).
// Nothing already owed changes.

const fail = (message, statusCode = 400) => { throw Object.assign(new Error(message), { statusCode }); };
const lower = (s) => String(s || "").trim().toLowerCase();
const pad = (n) => String(n).padStart(2, "0");
const dayOf = (v) => {
  if (!v) return null;
  if (v instanceof Date) return `${v.getFullYear()}-${pad(v.getMonth() + 1)}-${pad(v.getDate())}`;
  return String(v).slice(0, 10);
};
const list = (v) => {
  if (Array.isArray(v)) return v;
  try { return JSON.parse(v || "[]") || []; } catch { return []; }
};

async function activeHub(ownerAdminId, hubId) {
  const hub = hubId ? await LearningHubModel.findById(hubId) : null;
  if (!hub || hub.ownerAdminId !== ownerAdminId || hub.status === "removed" || hub.isHomeLearning) fail("Choose one of your learning hubs", 404);
  if (hub.status !== "active") fail(`${hub.name} isn't active — switch it on first`);
  return hub;
}

async function classAt(hub, classId) {
  if (!classId) return null;
  const cls = await ClassModel.findById(classId);
  if (!cls || cls.schoolId !== hub.id) fail(`Choose a class at ${hub.name}`);
  if ((cls.status || "active") !== "active") fail(`${classLabel(cls)} isn't active`);
  return cls;
}

// The learner in a class at a hub (or at the hub with no class): their link there is reused —
// whatever its state — so they keep one admission number per hub.
async function placeAtHub(learnerId, hubId, classId) {
  const link = await LearnerHubLinkModel.findOne(learnerId, hubId);
  if (link) await LearnerService.updateEnrollment(learnerId, hubId, { classId: classId || null, status: "active" });
  else await LearnerService.enrollInHub(learnerId, { hubId, classId: classId || "", status: "active", autoClass: false });
}

// The key of a place they hold at this hub, if any — a hub has one link per learner, so a new
// place there means leaving that one (or keeping it as it is).
const placeAtHubKey = (ctx, hubId) => ctx.places.find((p) => p.hubId === hubId)?.key || null;

async function billNew(kind, record) {
  try {
    await require("../billing/package-billing").billFamily(kind, record, { today: kenyaToday() });
  } catch (err) {
    console.error(`[learner-moves] could not raise the first ${kind} invoice:`, err.message);
  }
}

/* ── A hub (or school) class ───────────────────────────────────────────────── */

const hub = {
  async check(ctx, input) {
    const h = await activeHub(ctx.ownerAdminId, input.hubId);
    const cls = await classAt(h, input.classId);
    return {
      programme: "hub", hubId: h.id, classId: cls?.id || null, curriculumId: cls?.curriculumId || null,
      hubClash: placeAtHubKey(ctx, h.id), recordId: cls?.id || h.id,
      label: [h.name, cls ? classLabel(cls) : "no class yet"].join(" · "),
    };
  },
  async open(ctx, plan) {
    await placeAtHub(ctx.learner.id, plan.hubId, plan.classId);
    return { hubId: plan.hubId, classId: plan.classId, recordId: plan.recordId, label: plan.label };
  },
  async reassert(ctx, plan) {
    await placeAtHub(ctx.learner.id, plan.hubId, plan.classId);
  },
};

/* ── A bootcamp run ────────────────────────────────────────────────────────── */

const bootcamp = {
  async check(ctx, input) {
    const row = input.bootcampId ? await db("bootcamps").where({ id: input.bootcampId, ownerAdminId: ctx.ownerAdminId }).first() : null;
    if (!row) fail("Choose one of your bootcamps", 404);
    if ((row.audience || "learners") !== "learners") fail(`${row.name} is a training of trainers bootcamp for educators`);
    const end = dayOf(row.endDate);
    if (end && end < ctx.today) fail(`${row.name} has already ended — choose a run that hasn't`);
    const h = await activeHub(ctx.ownerAdminId, input.hubId);
    const offering = await require("../bootcamps/bootcamp-hub.model").findByBootcampAndHub(row.id, h.id);
    const classIds = list(offering?.classIds);
    if (!offering || !classIds.length) fail(`${row.name} doesn't run at ${h.name}`);
    let classId = input.classId || null;
    if (classId && !classIds.includes(classId)) fail(`Choose one of ${row.name}'s classes at ${h.name}`);
    if (!classId) {
      const { cohortClassFor } = require("../bootcamp-enrollment/bootcamp-enrollment.service").enrolmentHelpers;
      classId = await cohortClassFor({ ...offering, classIds }, row.curriculumId, { age: ctx.age });
    }
    const cls = await classAt(h, classId);
    let price = null;
    if (input.invoice) {
      price = resolveEffectiveBootcampPrice(row);
      if (!(Number(price.amount) > 0)) fail(`${row.name} has no price set — move them without an invoice, or price it first`);
    }
    return {
      programme: "bootcamp", hubId: h.id, classId: cls.id, curriculumId: row.curriculumId || cls.curriculumId || null,
      hubClash: placeAtHubKey(ctx, h.id), recordId: row.id, bootcamp: row, hubName: h.name, price,
      label: `${row.name} — ${h.name} · ${classLabel(cls)}`,
    };
  },
  async open(ctx, plan) {
    await placeAtHub(ctx.learner.id, plan.hubId, plan.classId);
    // Their stage and the bootcamp's pathway for it, as a website enrolment places them.
    await require("../bootcamp-enrollment/bootcamp-enrollment.service").placeOnBootcampPathway(ctx.learner.id, plan.bootcamp, plan.hubId, { age: ctx.age })
      .catch((err) => console.error("[learner-moves] could not place the learner on the bootcamp's pathway:", err.message));
    let invoice = null;
    if (plan.price) invoice = await raiseBootcampInvoice(ctx, plan);
    return { hubId: plan.hubId, classId: plan.classId, recordId: plan.recordId, label: plan.label, invoice };
  },
  async reassert(ctx, plan) {
    await placeAtHub(ctx.learner.id, plan.hubId, plan.classId);
  },
};

// The bootcamp's price as one invoice for the child, issued by the hub — as a website enrolment's
// is (bootcamp-enrollment.service.js's raiseEnrollmentInvoice), emailed to the family.
async function raiseBootcampInvoice(ctx, plan) {
  const { nextInvoiceNumber } = require("../bootcamp-enrollment/bootcamp-enrollment.service").enrolmentHelpers;
  const amount = Number(Number(plan.price.amount).toFixed(2));
  const currency = plan.price.currency || "KES";
  const invoice = await BillingModel.transaction(async (trx) => {
    const created = await BillingModel.createInvoice({
      invoiceNumber: await nextInvoiceNumber(trx),
      issuerType: "learning_hub", issuerHubId: plan.hubId, payerUserId: null, payerHubId: null,
      learnerId: ctx.learner.id, hubId: plan.hubId, invoiceType: "bootcamp", status: "issued", currency,
      subtotal: amount, discount: 0, total: amount, amountPaid: 0, issuedAt: new Date(), notes: null,
    }, trx);
    await BillingModel.createItem({
      invoiceId: created.id, learnerId: ctx.learner.id, courseId: null,
      description: `${plan.bootcamp.name} — enrolment (${fullName(ctx.learner)})`,
      quantity: 1, unitAmount: amount, totalAmount: amount, metadata: { bootcampId: plan.bootcamp.id, movedBy: ctx.req.user.id },
    }, trx);
    await BillingModel.createAuditEvent({ invoiceId: created.id, actorUserId: ctx.req.user.id, eventType: "invoice_issued", newStatus: "issued", amount, metadata: { source: "learner_move" } }, trx);
    return created;
  });
  require("../billing/billing.service").emailIssuedInvoice(invoice.id);
  return { id: invoice.id, invoiceNumber: invoice.invoiceNumber, total: amount, currency };
}

/* ── Home Learning ─────────────────────────────────────────────────────────── */

const homeLearning = {
  async check(ctx, input) {
    const { assertOwnCurriculum, resolveGrade, assertOwnEducator } = require("../home-learning/home-learning.service").internal;
    const enrollment = enrollmentSchema.omit({ learnerId: true, status: true }).safeParse(input.enrollment || {});
    if (!enrollment.success) fail(enrollment.error.issues[0]?.message || "Choose a curriculum and grade");
    const curriculum = await assertOwnCurriculum(ctx.ownerAdminId, enrollment.data.curriculumId);
    resolveGrade(curriculum, enrollment.data.gradeId);
    await assertOwnEducator(ctx.ownerAdminId, enrollment.data.educatorId || null);
    let household = null;
    let newHousehold = null;
    if (input.householdId) {
      household = await HouseholdModel.findById(input.householdId, ctx.ownerAdminId);
      if (!household || household.status === "cancelled") fail("Household not found", 404);
      if ((await HouseholdModel.countActive(household.id, ctx.ownerAdminId)) >= Number(household.childCount || 0)) {
        fail("That household has no free child place — raise its number of children on the Home Learning page first");
      }
    } else {
      // The parent's details come from the child's record, so their one login sees both programmes.
      const h = input.household || {};
      newHousehold = {
        ...h,
        guardianName: h.guardianName || ctx.learner.guardianName,
        guardianEmail: h.guardianEmail ?? ctx.learner.guardianEmail ?? "",
        guardianPhone: h.guardianPhone || ctx.learner.guardianPhone,
      };
      const parsed = householdSchema.safeParse(newHousehold);
      if (!parsed.success) fail(parsed.error.issues[0]?.message || "Check the household's details");
      const problem = startDateProblem(newHousehold.startDate || "", ctx.today);
      if (problem) fail(problem);
    }
    return {
      programme: "home_learning", enrollment: enrollment.data, household, newHousehold,
      curriculumId: curriculum.id, recordId: household?.id || null,
      label: `${household?.guardianName || newHousehold.guardianName}'s household`,
    };
  },
  async open(ctx, plan) {
    const HomeLearningService = require("../home-learning/home-learning.service");
    const { ensureHomeHub } = HomeLearningService.internal;
    let household = plan.household;
    let created = false;
    if (!household) {
      household = await HomeLearningService.create(ctx.ownerAdminId, plan.newHousehold);
      created = true;
    }
    try {
      await HomeLearningService.setEnrollment(ctx.ownerAdminId, household.id, {
        learnerId: ctx.learner.id, curriculumId: plan.enrollment.curriculumId, gradeId: plan.enrollment.gradeId,
        educatorId: plan.enrollment.educatorId || "", status: "active",
      });
    } catch (err) {
      // A household made for this move and left empty goes again, so a refused move leaves nothing.
      if (created && !(await HouseholdModel.findEnrollmentsByHousehold(household.id, ctx.ownerAdminId)).length) {
        await db("home_learning_households").where({ id: household.id, ownerAdminId: ctx.ownerAdminId }).del();
      }
      throw err;
    }
    if (created) {
      const fresh = await HouseholdModel.findById(household.id, ctx.ownerAdminId);
      if (fresh?.status === "active") await billNew("home_learning", fresh);
    }
    const hlHub = await ensureHomeHub(ctx.ownerAdminId);
    const place = await HouseholdModel.findEnrollment(household.id, ctx.learner.id, ctx.ownerAdminId);
    return {
      hubId: hlHub.id, classId: place?.classId || null, recordId: household.id,
      label: `${household.guardianName}'s household`, active: household.status === "active",
      createdHousehold: created,
    };
  },
  async reassert() {},
};

/* ── A Tech Club ───────────────────────────────────────────────────────────── */

const techClub = {
  async check(ctx, input) {
    const ClubService = require("../tech-clubs/club.service");
    const club = await ClubService.assertOwnClub(ctx.ownerAdminId, input.hubId);
    if (club.status !== "active") fail(`${club.name} isn't active — switch it on first`);
    const cls = await classAt(club, input.classId);
    let membership = null;
    let newMembership = null;
    let sameAs = null;
    if (input.membershipId) {
      membership = await ClubMembershipModel.findById(input.membershipId, ctx.ownerAdminId);
      if (!membership || membership.status === "cancelled") fail("Membership not found", 404);
      if (membership.hubId !== club.id) fail(`That membership is at another club, not ${club.name}`);
      const child = await ClubMembershipModel.findChild(membership.id, ctx.learner.id, ctx.ownerAdminId);
      if (child?.status === "active") sameAs = `club:${membership.id}`;
      else if ((await ClubMembershipModel.countActiveChildren(membership.id, ctx.ownerAdminId)) >= Number(membership.childCount || 0)) {
        fail("That membership has no free child place — raise its number of children on the Tech Clubs page first");
      }
    } else {
      const m = input.membership || {};
      if (!m.packageId) fail("Choose a package for the membership");
      const price = await ClubService.resolvePackagePrice(ctx.ownerAdminId, m.packageId, Math.max(1, Number(m.childCount) || 1), club.id, null, { billingPeriod: m.billingPeriod || null });
      const guardianName = String(m.guardianName || ctx.learner.guardianName || "").trim();
      if (!guardianName) fail("Enter the parent's name");
      const problem = startDateProblem(m.startDate || "", ctx.today);
      if (problem) fail(problem);
      newMembership = {
        packageId: price.packageId, childCount: price.childCount, amount: price.amount, billingPeriod: price.billingPeriod,
        guardianName: guardianName.slice(0, 150),
        guardianEmail: String(m.guardianEmail ?? ctx.learner.guardianEmail ?? "").trim() || null,
        guardianPhone: String(m.guardianPhone || ctx.learner.guardianPhone || "").trim() || null,
        startDate: m.startDate || ctx.today,
      };
    }
    return {
      programme: "tech_club", hubId: club.id, classId: cls?.id || null, curriculumId: cls?.curriculumId || null,
      club, membership, newMembership, sameAs, hubClash: placeAtHubKey(ctx, club.id),
      recordId: membership?.id || null, label: `${club.name}${cls ? ` · ${classLabel(cls)}` : " · awaiting a class"}`,
    };
  },
  async open(ctx, plan) {
    const { syncMembershipChildren } = require("../tech-clubs/club.service");
    let membership = plan.membership;
    let created = false;
    if (!membership) {
      const m = plan.newMembership;
      membership = await ClubMembershipModel.create({
        ownerAdminId: ctx.ownerAdminId, hubId: plan.hubId, packageId: m.packageId,
        guardianName: m.guardianName, guardianEmail: m.guardianEmail, guardianPhone: m.guardianPhone,
        childCount: m.childCount, amount: m.amount, billingPeriod: m.billingPeriod,
        // Billed from its start day, by the automatic package billing.
        billingAnchor: m.startDate, billedThrough: null,
        status: "active", source: "staff", startDate: m.startDate,
        notes: `Made when ${fullName(ctx.learner)} was moved here on ${ctx.today}.`,
      });
      created = true;
    }
    try {
      const child = await ClubMembershipModel.findChild(membership.id, ctx.learner.id, ctx.ownerAdminId);
      if (child) await ClubMembershipModel.updateChild(child.id, { status: "active", classId: plan.classId });
      else await ClubMembershipModel.createChild({ ownerAdminId: ctx.ownerAdminId, membershipId: membership.id, learnerId: ctx.learner.id, classId: plan.classId, status: "active", placementNotes: null });
      await syncMembershipChildren(await ClubMembershipModel.findById(membership.id, ctx.ownerAdminId));
    } catch (err) {
      if (created) await ClubMembershipModel.deleteMembership(membership.id).catch(() => {});
      throw err;
    }
    if (created) await billNew("tech_club", await ClubMembershipModel.findById(membership.id, ctx.ownerAdminId));
    return { hubId: plan.hubId, classId: plan.classId, recordId: membership.id, label: plan.label, active: membership.status === "active" };
  },
  async reassert(ctx, plan, opened) {
    const { syncMembershipChildren } = require("../tech-clubs/club.service");
    const membership = await ClubMembershipModel.findById(opened.recordId, ctx.ownerAdminId);
    if (membership) await syncMembershipChildren(membership);
  },
};

/* ── A pathway plan ────────────────────────────────────────────────────────── */

// The pathway's rows (one per stage) in each of the workspace's curricula that use it.
async function pathwayRowsByCurriculum(ownerAdminId, name) {
  const curricula = await db("curricula").where({ ownerAdminId }).select("id", "name");
  if (!curricula.length) return [];
  const rows = (await db("pathways").whereIn("curriculumId", curricula.map((c) => c.id)))
    .filter((r) => lower(r.name) === lower(name));
  const stageIds = [...new Set(rows.map((r) => r.ageCategoryId).filter(Boolean))];
  const stages = new Map((stageIds.length ? await db("age_categories").whereIn("id", stageIds) : []).map((s) => [s.id, s]));
  return curricula.map((c) => ({
    curriculumId: c.id, curriculumName: c.name,
    rows: rows.filter((r) => r.curriculumId === c.id).map((r) => ({ ...r, stage: stages.get(r.ageCategoryId) || null }))
      .sort((a, b) => (a.stage?.minAge ?? 0) - (b.stage?.minAge ?? 0)),
  })).filter((c) => c.rows.length);
}

// Which stage row a learner starts on: where they're already placed on this pathway, else the one
// their age falls in, else the one staff chose, else the first.
async function stageRowFor(learnerId, rows, age, chosenId) {
  const placed = await db("learner_pathways").where({ learnerId }).whereIn("pathwayId", rows.map((r) => r.id)).orderBy("updatedAt", "desc").first();
  if (placed) return { row: rows.find((r) => r.id === placed.pathwayId), placed: true };
  if (chosenId) {
    const chosen = rows.find((r) => r.id === chosenId);
    if (!chosen) fail("Choose one of the pathway's stages");
    return { row: chosen, placed: false };
  }
  const byAge = age == null ? null : rows.find((r) => r.stage?.minAge != null && r.stage?.maxAge != null && age >= r.stage.minAge && age <= r.stage.maxAge);
  return { row: byAge || rows[0], placed: false };
}

const pathway = {
  pathwayRowsByCurriculum,
  async check(ctx, input) {
    const plan = input.packageId ? await PathwayPackageModel.findById(input.packageId, ctx.ownerAdminId) : null;
    if (!plan || plan.status !== "active") fail("Choose one of your pathway plans", 404);
    const template = await db("pathway_templates").where({ id: plan.pathwayTemplateId, ownerAdminId: ctx.ownerAdminId }).first();
    if (!template) fail("That plan's pathway isn't in your catalogue any more");
    const curricula = await pathwayRowsByCurriculum(ctx.ownerAdminId, template.name);
    if (!curricula.length) fail(`No curriculum of yours runs ${template.name}`);
    const held = new Set(ctx.places.map((p) => p.curriculumId).filter(Boolean));
    const curriculum = (input.curriculumId && curricula.find((c) => c.curriculumId === input.curriculumId))
      || curricula.find((c) => held.has(c.curriculumId)) || curricula[0];
    if (input.curriculumId && curriculum.curriculumId !== input.curriculumId) fail(`That curriculum doesn't run ${template.name}`);
    const { row, placed } = await stageRowFor(ctx.learner.id, curriculum.rows, ctx.age, input.pathwayRowId || null);
    const h = await activeHub(ctx.ownerAdminId, input.hubId);

    // Already on a live subscription of this pathway: that's the place (leave it to move them).
    const onIt = ctx.places.find((p) => p.programme === "pathway" && p.pathwayTemplateId === plan.pathwayTemplateId);
    let subscription = null;
    let newSubscription = null;
    if (input.subscriptionId) {
      subscription = await PathwaySubscriptionModel.findById(input.subscriptionId, ctx.ownerAdminId);
      if (!subscription || subscription.status === "cancelled") fail("Subscription not found", 404);
      if (subscription.pathwayTemplateId !== plan.pathwayTemplateId) fail(`That subscription is for ${subscription.pathwayName}, not ${template.name}`);
      const active = await PathwaySubscriptionModel.activeLearnerIds(subscription.id);
      if (!active.includes(ctx.learner.id) && active.length >= Number(subscription.childCount || 0)) {
        fail("That subscription has no free child place — change its plan on the Pathway Subscriptions page first");
      }
    } else {
      const PathwaySubscriptionService = require("../pathway-subscriptions/pathway-subscription.service");
      if (input.billingPeriod && !PathwaySubscriptionService.PLAN_PERIODS.includes(input.billingPeriod)) fail("Choose how often they pay");
      const price = PathwaySubscriptionService.priceFor(plan, 1, input.billingPeriod || null);
      if (!price) fail(`${plan.name} isn't offered for that period`);
      const problem = startDateProblem(input.startDate || "", ctx.today);
      if (problem) fail(problem);
      const guardianName = String(input.guardianName || ctx.learner.guardianName || "").trim();
      if (!guardianName) fail("Enter the parent's name");
      newSubscription = {
        childCount: price.childCount, amount: price.amount, billingPeriod: price.billingPeriod,
        guardianName: guardianName.slice(0, 150),
        guardianEmail: String(input.guardianEmail ?? ctx.learner.guardianEmail ?? "").trim() || null,
        guardianPhone: String(input.guardianPhone || ctx.learner.guardianPhone || "").trim() || null,
        startDate: input.startDate || ctx.today,
      };
    }
    return {
      programme: "pathway", hubId: h.id, classId: null, curriculumId: curriculum.curriculumId,
      plan, template, row, placedAlready: placed, subscription, newSubscription,
      sameAs: onIt?.key || (subscription ? `pathway:${subscription.id}` : null),
      recordId: subscription?.id || null,
      label: `${row.name} — ${plan.name}`,
    };
  },
  async open(ctx, plan) {
    const PathwaySubscriptionService = require("../pathway-subscriptions/pathway-subscription.service");
    let sub = plan.subscription;
    let created = false;
    if (!sub) {
      const s = plan.newSubscription;
      // A later start covers time already paid for elsewhere: the courses are open until then.
      const openUntil = s.startDate > ctx.today ? addDays(s.startDate, -1) : null;
      sub = await PathwaySubscriptionModel.create({
        ownerAdminId: ctx.ownerAdminId, packageId: plan.plan.id, pathwayTemplateId: plan.plan.pathwayTemplateId,
        curriculumId: plan.curriculumId, pathwayName: plan.row.name, hubId: plan.hubId,
        guardianName: s.guardianName, guardianEmail: s.guardianEmail, guardianPhone: s.guardianPhone,
        childCount: s.childCount, amount: s.amount, billingPeriod: s.billingPeriod,
        billingAnchor: s.startDate, billedThrough: null, accessUntil: openUntil,
        status: "active", source: "staff", startDate: s.startDate,
        notes: `Made when ${fullName(ctx.learner)} was moved here on ${ctx.today}.`,
      });
      created = true;
    }
    try {
      const courseIds = await require("../curriculum/competency-framework/competency.service").orderedPathwayCourseIds(plan.curriculumId, plan.row);
      const existing = await db("pathway_subscription_children").where({ subscriptionId: sub.id, learnerId: ctx.learner.id }).first();
      if (existing) await db("pathway_subscription_children").where({ id: existing.id }).update({ status: "active", pathwayId: plan.row.id, updatedAt: new Date() });
      else await PathwaySubscriptionModel.addChild({ ownerAdminId: ctx.ownerAdminId, subscriptionId: sub.id, learnerId: ctx.learner.id, pathwayId: plan.row.id, startCourseId: courseIds[0] || null, status: "active" });
      // At the hub with no class (a class there is optional), at the pathway's stage.
      const link = await LearnerHubLinkModel.findOne(ctx.learner.id, plan.hubId);
      if (!link) await LearnerService.enrollInHub(ctx.learner.id, { hubId: plan.hubId, status: "active", autoClass: false });
      else if (link.status !== "active") await LearnerHubLinkModel.update(link.id, { status: "active" });
      const fresh = await LearnerHubLinkModel.findOne(ctx.learner.id, plan.hubId);
      if (fresh && !fresh.currentStageId && plan.row.ageCategoryId) await LearnerHubLinkModel.update(fresh.id, { currentStageId: plan.row.ageCategoryId, stageSource: "age" });
      // On the pathway at its first course — never moved back when already on it.
      if (!plan.placedAlready && courseIds[0]) {
        await LearnerPathwayModel.place(ctx.learner.id, plan.curriculumId, plan.row.id, courseIds[0], "enrolled", null, "auto");
      }
    } catch (err) {
      if (created) {
        await db("pathway_subscription_children").where({ subscriptionId: sub.id }).del().catch(() => {});
        await PathwaySubscriptionModel.delete(sub.id).catch(() => {});
      }
      throw err;
    }
    const current = await PathwaySubscriptionModel.findById(sub.id, ctx.ownerAdminId);
    // Access to what's paid for (or the time before a later start), for every child on it.
    if (current.accessUntil && current.status === "active") await PathwaySubscriptionService.syncAccess(current);
    if (created) await billNew("pathway_subscription", current);
    return { hubId: plan.hubId, classId: null, recordId: sub.id, label: plan.label, active: current.status === "active" };
  },
  async reassert(ctx, plan) {
    const link = await LearnerHubLinkModel.findOne(ctx.learner.id, plan.hubId);
    if (link && link.status !== "active") await LearnerHubLinkModel.update(link.id, { status: "active" });
  },
};

const DESTINATIONS = { hub, bootcamp, home_learning: homeLearning, tech_club: techClub, pathway };

module.exports = { DESTINATIONS, pathwayRowsByCurriculum, dayOf, list };
