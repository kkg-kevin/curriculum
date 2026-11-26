const db = require("../../config/db");
const LearnerModel = require("../learners/learner.model");
const LearningHubModel = require("../learning-hubs/learning-hub.model");
const HouseholdModel = require("../home-learning/home-learning.model");
const ClubMembershipModel = require("../tech-clubs/club.model");
const ClubPackageModel = require("../tech-clubs/club-package.model");
const { PathwayPackageModel, PathwaySubscriptionModel } = require("../pathway-subscriptions/pathway-subscription.model");
const { pricesOf } = require("../home-learning/home-learning.pricing");
const { resolveEffectiveBootcampPrice } = require("../../shared/utils/bootcamp-pricing");
const { generateId } = require("../../shared/utils/model.utils");
const { kenyaToday, learnerAge } = require("../../shared/utils/age");
const R = require("./learner-move.rules");
const { placesOf, endPlace, classLabel } = require("./learner-move.places");
const { DESTINATIONS, pathwayRowsByCurriculum, dayOf, list } = require("./learner-move.destinations");
const { describePlaces } = require("./learner-move.details");
const { pastProgrammes } = require("./learner-move.past");
const NotificationService = require("../notifications/notification.service");

// Moving a learner between programmes (16 Nov 2026) — staff learner page → Move learner:
//   1. where to: a hub class, a bootcamp run, Home Learning, a Tech Club or a pathway plan;
//   2. the new place, opened through that programme's own code (learner-move.destinations.js);
//   3. the places they leave, ended, never deleted (learner-move.places.js) — and a household,
//      membership or subscription left with no child stopped, when staff tick it;
//   4. one learner_transfers row per place left (one when none), read back as their Moves.
// Everything about the destination is checked before anything is written. Their work, reports,
// certificates, attendance, diagnostics, pathway placement and invoices stay theirs. Money already
// owed is untouched (only warned about); a new household / membership / subscription is billed
// from the day staff choose.

const fail = (message, statusCode = 400) => { throw Object.assign(new Error(message), { statusCode }); };
const OPEN_INVOICE = ["issued", "partially_paid", "overdue"];
const isStaff = (req) => req.user?.actualRole === "collaborator";

function allowedProgrammes(req) {
  const can = require("../access/access.service").can;
  return Object.fromEntries(R.PROGRAMMES.map((p) => {
    const module = R.DESTINATION_MODULE[p];
    return [p, !isStaff(req) || !module || can(req.user.permissions, module, "create")];
  }));
}

async function inWorkspace(ownerAdminId, learnerId) {
  const { learnerInWorkspace } = require("../home-learning/home-learning.service").internal;
  if (await learnerInWorkspace(ownerAdminId, learnerId)) return true;
  if (await db("club_membership_children").where({ learnerId, ownerAdminId }).first()) return true;
  return Boolean(await db("pathway_subscription_children").where({ learnerId, ownerAdminId }).first());
}

async function loadLearner(ownerAdminId, learnerId) {
  const learner = await LearnerModel.findById(learnerId);
  if (!learner || !(await inWorkspace(ownerAdminId, learner.id))) fail("Learner not found", 404);
  if (learner.teacherId) fail("An educator in training is moved from their educator page (Training)");
  return learner;
}

// After a move, a short note to the parent's login (bell + email: learner_moved): where the child
// went, and that their earlier reports and certificates are still theirs. Only when the child
// actually left somewhere, and only to a parent login (never a staff account on the same email).
async function tellParent(ctx, ended, toLabel) {
  const { learner } = ctx;
  if (!ended.length || !learner.guardianEmail) return false;
  const parent = await db("users").whereRaw("LOWER(email) = ?", [String(learner.guardianEmail).trim().toLowerCase()])
    .where({ role: "learner" }).whereNull("deactivatedAt").first("id");
  if (!parent) return false;
  const first = learner.firstName || "Your child";
  const from = [...new Set(ended.map((e) => e.label).filter(Boolean))].join(" and ");
  await NotificationService.notifyPerson(parent.id, {
    type: "learner_moved",
    title: `${first} has moved to ${toLabel}`.slice(0, 200),
    message: `${first} has moved${from ? ` from ${from}` : ""} to ${toLabel}. Everything ${first} did before — reports, certificates and marked work — is still on their record: open ${first}'s page and look under Reports → Earlier programmes.`,
    payload: { learnerId: learner.id, route: `/parent/children/${learner.id}` },
    ownerAdminId: ctx.ownerAdminId,
  });
  return true;
}

async function openInvoices(learnerId) {
  const rows = await db("billing_invoices").whereIn("status", OPEN_INVOICE)
    .where((w) => w.where({ learnerId }).orWhereIn("id", db("billing_invoice_items").where({ learnerId }).select("invoiceId")))
    .select("id", "invoiceNumber", "total", "amountPaid", "currency");
  return rows.map((r) => ({ id: r.id, invoiceNumber: r.invoiceNumber, owed: Math.max(0, Number(r.total || 0) - Number(r.amountPaid || 0)), currency: r.currency || "KES" }))
    .filter((r) => r.owed > 0);
}

const count = async (query) => Number((await query.count({ n: "*" }).first())?.n || 0);

// What stays with them, whatever the move: shown in the dialog so staff see nothing is lost.
async function keepsOf(learnerId) {
  return {
    markedWork: await count(db("assessment_submissions").where({ learnerId, status: "graded" })),
    reports: await count(db("reports").where({ learnerId, status: "published" })),
    certificates: await count(db("certificates").where({ learnerId, status: "issued" })),
    attendanceDays: await count(db("attendance").where({ learnerId })),
    pathways: await count(db("learner_pathways").where({ learnerId })),
  };
}

/* ── What the dialog offers ────────────────────────────────────────────────── */

async function hubsWithClasses(ownerAdminId) {
  const hubs = (await LearningHubModel.findAll({ ownerAdminId }))
    .filter((h) => h.status === "active" && !h.isHomeLearning);
  const classes = hubs.length ? await db("classes").whereIn("schoolId", hubs.map((h) => h.id)).where({ status: "active" }).select("id", "schoolId", "gradeName", "streamName", "curriculumId") : [];
  return hubs.map((h) => ({
    id: h.id, name: h.name, hubType: h.hubType,
    classes: classes.filter((c) => c.schoolId === h.id).map((c) => ({ id: c.id, label: classLabel(c), curriculumId: c.curriculumId || null })),
  })).sort((a, b) => a.name.localeCompare(b.name));
}

async function bootcampsOffered(ownerAdminId, hubs, today) {
  const rows = (await db("bootcamps").where({ ownerAdminId }).select("*"))
    .filter((b) => (b.audience || "learners") === "learners" && (!b.endDate || dayOf(b.endDate) >= today));
  if (!rows.length) return [];
  const runs = await db("bootcamp_hubs").whereIn("bootcampId", rows.map((b) => b.id));
  const hubById = new Map(hubs.map((h) => [h.id, h]));
  return rows.map((b) => {
    const price = resolveEffectiveBootcampPrice(b);
    return {
      id: b.id, name: b.name, startDate: dayOf(b.startDate), endDate: dayOf(b.endDate), curriculumId: b.curriculumId || null,
      price: Number(price.amount) > 0 ? { amount: Number(price.amount), currency: price.currency || "KES" } : null,
      runs: runs.filter((r) => r.bootcampId === b.id && hubById.has(r.hubId)).map((r) => {
        const ids = list(r.classIds);
        return { hubId: r.hubId, hubName: hubById.get(r.hubId).name, classes: hubById.get(r.hubId).classes.filter((c) => ids.includes(c.id)) };
      }).filter((r) => r.classes.length),
    };
  }).filter((b) => b.runs.length).sort((a, b) => String(a.startDate || "").localeCompare(String(b.startDate || "")));
}

// The learners' bootcamp run (not yet ended) whose classes at this hub include this class, if any.
async function runOfClass(ownerAdminId, hubId, classId, today) {
  const offerings = await db("bootcamp_hubs").where({ hubId });
  const ids = offerings.filter((o) => list(o.classIds).includes(classId)).map((o) => o.bootcampId);
  if (!ids.length) return null;
  const runs = await db("bootcamps").whereIn("id", ids).where({ ownerAdminId }).select("id", "endDate", "audience");
  return runs.find((b) => (b.audience || "learners") === "learners" && (!b.endDate || dayOf(b.endDate) >= today)) || null;
}

const priceList = (pkg) => pricesOf(pkg).filter((p) => p.billingPeriod !== "daily")
  .map((p) => ({ billingPeriod: p.billingPeriod, amount: Number(p.amount), extraChildAmount: Number(p.extraChildAmount || 0) }));

async function techClubOptions(ownerAdminId, hubs, learner) {
  const clubs = hubs.filter((h) => h.hubType !== "school");
  const packages = (await ClubPackageModel.findAll(ownerAdminId)).filter((p) => p.status === "active");
  const memberships = learner.guardianEmail
    ? (await ClubMembershipModel.findByGuardianEmail(learner.guardianEmail)).filter((m) => m.ownerAdminId === ownerAdminId)
    : [];
  return {
    clubs: clubs.map((c) => ({ id: c.id, name: c.name, classes: c.classes })),
    packages: packages.map((p) => ({
      id: p.id, name: p.name, childrenIncluded: p.childrenIncluded, allowExtraChildren: !!p.allowExtraChildren, maxChildren: p.maxChildren,
      hubIds: Array.isArray(p.hubIds) ? p.hubIds : [], defaultPeriod: p.billingPeriod, prices: priceList(p),
    })),
    memberships: await Promise.all(memberships.map(async (m) => ({
      id: m.id, hubId: m.hubId, clubName: clubs.find((c) => c.id === m.hubId)?.name || "A club", status: m.status,
      guardianName: m.guardianName, childCount: Number(m.childCount || 0),
      activeChildren: await ClubMembershipModel.countActiveChildren(m.id, ownerAdminId),
      packageName: packages.find((p) => p.id === m.packageId)?.name || null,
    }))),
  };
}

async function pathwayOptions(ownerAdminId, learner, age) {
  const plans = (await PathwayPackageModel.findAll(ownerAdminId)).filter((p) => p.status === "active");
  const templateIds = [...new Set(plans.map((p) => p.pathwayTemplateId).filter(Boolean))];
  const templates = templateIds.length ? await db("pathway_templates").whereIn("id", templateIds).where({ ownerAdminId }).select("id", "name") : [];
  const pathways = [];
  for (const t of templates) {
    const curricula = await pathwayRowsByCurriculum(ownerAdminId, t.name);
    if (!curricula.length) continue;
    pathways.push({
      templateId: t.id, name: t.name,
      curricula: curricula.map((c) => {
        const byAge = age == null ? null : c.rows.find((r) => r.stage?.minAge != null && r.stage?.maxAge != null && age >= r.stage.minAge && age <= r.stage.maxAge);
        return {
          curriculumId: c.curriculumId, curriculumName: c.curriculumName,
          stages: c.rows.map((r) => ({ rowId: r.id, name: r.stage?.name || r.name, minAge: r.stage?.minAge ?? null, maxAge: r.stage?.maxAge ?? null })),
          suggestedRowId: byAge?.id || c.rows[0]?.id || null,
        };
      }),
    });
  }
  const subs = learner.guardianEmail
    ? (await PathwaySubscriptionModel.findByGuardianEmail(learner.guardianEmail)).filter((s) => s.ownerAdminId === ownerAdminId && s.status !== "cancelled")
    : [];
  return {
    plans: plans.filter((p) => pathways.some((w) => w.templateId === p.pathwayTemplateId)).map((p) => ({
      id: p.id, name: p.name, pathwayTemplateId: p.pathwayTemplateId, childrenIncluded: p.childrenIncluded,
      defaultPeriod: p.billingPeriod, prices: priceList(p), isPublished: !!p.isPublished,
    })),
    pathways,
    subscriptions: await Promise.all(subs.map(async (s) => ({
      id: s.id, pathwayTemplateId: s.pathwayTemplateId, pathwayName: s.pathwayName, status: s.status, hubId: s.hubId,
      guardianName: s.guardianName, childCount: Number(s.childCount || 0), packageId: s.packageId,
      activeChildren: (await PathwaySubscriptionModel.activeLearnerIds(s.id)).length,
      planName: plans.find((p) => p.id === s.packageId)?.name || null,
    }))),
  };
}

async function householdOptions(ownerAdminId, learner) {
  const households = learner.guardianEmail
    ? (await HouseholdModel.findByGuardianEmail(learner.guardianEmail)).filter((h) => h.ownerAdminId === ownerAdminId && h.status !== "cancelled")
    : [];
  return Promise.all(households.map(async (h) => ({
    id: h.id, guardianName: h.guardianName, guardianEmail: h.guardianEmail, status: h.status, packageId: h.packageId,
    childCount: Number(h.childCount || 0), activeChildren: await HouseholdModel.countActive(h.id, ownerAdminId),
  })));
}

const LearnerMoveService = {
  async options(req, learnerId) {
    const ownerAdminId = req.ownerAdminId;
    const learner = await loadLearner(ownerAdminId, learnerId);
    const today = kenyaToday();
    const age = learnerAge(learner);
    const hubs = await hubsWithClasses(ownerAdminId);
    // Where they're at: each place described in facts, and what they're learning now.
    const places = await placesOf(ownerAdminId, learner.id);
    const { details, learning } = await describePlaces(learner.id, places);
    return {
      today,
      learner: {
        id: learner.id, firstName: learner.firstName, lastName: learner.lastName, age, accountStatus: learner.accountStatus || "active",
        guardianName: learner.guardianName || "", guardianEmail: learner.guardianEmail || "", guardianPhone: learner.guardianPhone || "",
      },
      places: places.map((p) => ({ ...p, facts: details[p.key] || [] })),
      learning,
      keeps: await keepsOf(learner.id),
      openInvoices: await openInvoices(learner.id),
      allowed: allowedProgrammes(req),
      destinations: {
        hubs,
        bootcamps: await bootcampsOffered(ownerAdminId, hubs, today),
        homeLearning: { households: await householdOptions(ownerAdminId, learner) },
        techClubs: await techClubOptions(ownerAdminId, hubs, learner),
        pathways: await pathwayOptions(ownerAdminId, learner, age),
      },
    };
  },

  // { destination: { programme, …its fields }, endKeys: [place keys], stopKeys: [place keys] }
  async move(req, learnerId, input) {
    const ownerAdminId = req.ownerAdminId;
    const programme = input.destination?.programme;
    const adapter = DESTINATIONS[programme];
    if (!adapter) fail("Choose where they're moving to");
    if (!allowedProgrammes(req)[programme]) {
      fail(`Your role doesn't allow you to add people to ${R.PROGRAMME_LABELS[programme]}.`, 403);
    }
    const learner = await loadLearner(ownerAdminId, learnerId);
    const places = await placesOf(ownerAdminId, learner.id);
    const today = kenyaToday();
    const ctx = { req, ownerAdminId, learner, places, today, age: learnerAge(learner) };
    const endKeys = [...new Set(input.endKeys || [])];
    const stopKeys = new Set(input.stopKeys || []);

    // Everything checked before anything is written.
    const plan = await adapter.check(ctx, input.destination);
    const problems = R.moveProblems({ places, endKeys, destination: plan });
    if (problems.length) fail(problems[0]);

    const opened = await adapter.open(ctx, plan);
    const ended = [];
    const notEnded = [];
    for (const key of endKeys) {
      const place = places.find((p) => p.key === key);
      try {
        ended.push(await endPlace(ctx, place, { stop: stopKeys.has(key) }));
      } catch (err) {
        console.error(`[learner-moves] could not end ${key} for ${learner.id}:`, err.message);
        notEnded.push({ label: place.label, reason: err.message });
      }
    }
    // A place left at the same hub shares the hub link: the new place is put back on it.
    await adapter.reassert(ctx, plan, opened);

    // An account switched off comes back on with an active place (one waiting for payment is
    // billing's to decide).
    if ((learner.accountStatus || "active") === "inactive" && opened.active !== false) {
      await LearnerModel.update(learner.id, { accountStatus: "active" });
    }

    const toLabel = opened.label;
    const rows = (ended.length ? ended : [null]).map((from) => ({
      id: generateId(), learnerId: learner.id,
      fromHubId: from?.hubId || null, toHubId: opened.hubId || null,
      fromClassId: from?.classId || null, toClassId: opened.classId || null,
      fromAdmissionNumber: from?.admissionNumber || null, transferredBy: req.user.id,
      fromProgramme: from?.programme || null, toProgramme: programme,
      fromRecordId: from?.recordId || null, toRecordId: opened.recordId || null,
      fromLabel: from?.label ? from.label.slice(0, 200) : null, toLabel: toLabel.slice(0, 200),
      notes: R.moveNote(from?.label || null, toLabel).slice(0, 500), createdAt: new Date(),
    }));
    await db("learner_transfers").insert(rows);

    // The family hears where the child went and that nothing earlier was lost (staff can untick it).
    let parentTold = false;
    if (input.notifyParent !== false) {
      parentTold = await tellParent(ctx, ended, toLabel).catch((err) => {
        console.error(`[learner-moves] parent notice for ${learner.id} failed:`, err.message);
        return false;
      });
    }

    return {
      programme, label: toLabel, recordId: opened.recordId, active: opened.active !== false,
      ended: ended.length, notEnded, invoice: opened.invoice || null, parentTold,
    };
  },

  // A learner into one class at a hub (27 Nov 2026) — the move behind "Enroll" at a hub they're
  // already at (learner page, hub's Add an existing learner) and a bootcamp run's "Bring back
  // learners". A hub has one place per learner, so the place they hold there is left (ended and
  // written down) and the new class put on the same hub link: one admission number per hub.
  // A class of a bootcamp run that hasn't ended is a bootcamp move (placed on its pathway, an
  // invoice if asked); any other class a hub move. Only a plain hub / bootcamp place is left here
  // — a learner whose place at the hub is Home Learning, a Tech Club or a pathway plan is moved
  // from their page, where staff see what that ends.
  //   { hubId, classId?, bootcampId?, invoice?, notifyParent?, alsoEndKeys? }
  async moveIntoClass(req, learnerId, { hubId, classId = null, bootcampId = null, invoice = false, notifyParent = true, alsoEndKeys = [] }) {
    const ownerAdminId = req.ownerAdminId;
    const learner = await loadLearner(ownerAdminId, learnerId);
    const first = learner.firstName || "This learner";
    const places = await placesOf(ownerAdminId, learner.id);
    const here = places.find((p) => p.hubId === hubId) || null;
    if (here && !String(here.key).startsWith("link:")) {
      fail(`${first} is in ${here.label} at this hub — move them from their page (Move learner), which shows what that ends`, 409);
    }
    if (here && classId && here.classId === classId && (here.status || "active") === "active") {
      fail(`${first} is already in that class`, 409);
    }
    let runId = bootcampId;
    if (!runId && classId) runId = (await runOfClass(ownerAdminId, hubId, classId, kenyaToday()))?.id || null;
    const destination = runId
      ? { programme: "bootcamp", bootcampId: runId, hubId, classId, invoice: !!invoice }
      : { programme: "hub", hubId, classId };
    const endKeys = [...new Set([...(here ? [here.key] : []), ...alsoEndKeys.filter((k) => places.some((p) => p.key === k))])];
    return this.move(req, learner.id, { destination, endKeys, notifyParent });
  },

  // Earlier programmes (learner-move.past.js): the learner themself (or their parent) sees all of
  // theirs; a hub login, its own hub's; an admin or staff member, their workspace's.
  async past(req, learnerId) {
    if (req.user.role === "learner") {
      if (!req.ownLearner) return [];
      return pastProgrammes(req.ownLearner.id, null);
    }
    if (req.user.role === "school") {
      const hubId = req.ownSchool?.id;
      const linked = hubId && (await db("learner_hub_links").where({ learnerId, hubId }).first("id"));
      if (!linked) fail("Learner not found", 404);
      return pastProgrammes(learnerId, [hubId]);
    }
    const learner = await LearnerModel.findById(learnerId);
    if (!learner || !(await inWorkspace(req.ownerAdminId, learner.id))) fail("Learner not found", 404);
    const hubs = await LearningHubModel.findAll({ ownerAdminId: req.ownerAdminId, includeDrafts: true });
    return pastProgrammes(learner.id, hubs.map((h) => h.id));
  },

  // The learner's Moves, newest first: rows written before 16 Nov 2026 have no labels, so their
  // hubs and classes are named from the records.
  async history(req, learnerId) {
    const learner = await loadLearner(req.ownerAdminId, learnerId);
    const rows = await db("learner_transfers").where({ learnerId: learner.id }).orderBy("createdAt", "desc");
    if (!rows.length) return [];
    const hubIds = [...new Set(rows.flatMap((r) => [r.fromHubId, r.toHubId]).filter(Boolean))];
    const classIds = [...new Set(rows.flatMap((r) => [r.fromClassId, r.toClassId]).filter(Boolean))];
    const userIds = [...new Set(rows.map((r) => r.transferredBy).filter(Boolean))];
    const hubs = new Map((hubIds.length ? await db("learning_hubs").whereIn("id", hubIds).select("id", "name") : []).map((h) => [h.id, h.name]));
    const classes = new Map((classIds.length ? await db("classes").whereIn("id", classIds).select("id", "gradeName", "streamName") : []).map((c) => [c.id, classLabel(c)]));
    const users = new Map((userIds.length ? await db("users").whereIn("id", userIds).select("id", "name") : []).map((u) => [u.id, u.name]));
    const side = (r, which) => {
      const programme = r[`${which}Programme`] || null;
      const label = r[`${which}Label`] || [hubs.get(r[`${which}HubId`]), classes.get(r[`${which}ClassId`])].filter(Boolean).join(" · ") || null;
      return programme || label ? { programme, programmeLabel: R.PROGRAMME_LABELS[programme] || null, label } : null;
    };
    return rows.map((r) => ({
      id: r.id, at: r.createdAt, by: users.get(r.transferredBy) || null,
      from: side(r, "from"), to: side(r, "to"),
      admissionNumber: r.fromAdmissionNumber || null, notes: r.notes || null,
    }));
  },
};

module.exports = LearnerMoveService;
