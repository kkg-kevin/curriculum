const db = require("../../config/db");
const HouseholdModel = require("./home-learning.model");
const LearnerModel = require("../learners/learner.model");
const LearnerHubLinkModel = require("../learners/learner-hub-link.model");
const LearningHubModel = require("../learning-hubs/learning-hub.model");
const { generateId } = require("../../shared/utils/model.utils");
const { enrollmentSchema } = require("./home-learning.validation");

// Moving a learner already in the system — on a bootcamp, at a hub — into Home Learning
// (13 Nov 2026), in one step from the staff learner page ("Move to Home Learning"):
//   1. a household: one of the family's (same parent email) or a new one, its parent details from
//      the child's record (so the parent's one login sees everything);
//   2. the child's Home Learning place — Home Learning's own setEnrollment, so the class, educator
//      links and placement are exactly what the Home Learning page makes;
//   3. the places they leave are ended, never deleted — the hub link goes inactive (as a hub's
//      switch-off does) and a learner_transfers row says "moved to Home Learning", so History
//      shows it.
// Nothing about the child's history moves or changes: reports, work, attendance, certificates,
// diagnostics and invoices belong to the learner, not the programme. Money is untouched: an
// unpaid invoice stays owed and its pausing rules (billing.access.js) are as before — the move
// only warns about it.

const fail = (message, statusCode = 400) => { throw Object.assign(new Error(message), { statusCode }); };
const lower = (s) => String(s || "").trim().toLowerCase();
const OPEN_INVOICE = ["issued", "partially_paid", "overdue"];
const internal = () => require("./home-learning.service").internal;

async function loadLearner(ownerAdminId, learnerId) {
  const learner = await LearnerModel.findById(learnerId);
  if (!learner || !(await internal().learnerInWorkspace(ownerAdminId, learner.id))) fail("Learner not found", 404);
  return learner;
}

// The child's current Home Learning place (any status but removed), if they have one.
async function homeLearningPlace(ownerAdminId, learnerId) {
  const rows = await HouseholdModel.findEnrollmentsByLearner(learnerId);
  return rows.find((e) => e.ownerAdminId === ownerAdminId && e.status !== "removed") || null;
}

// The places the child holds in this workspace's hubs (not Home Learning's), each with what it is:
// a bootcamp's cohort class says which bootcamp.
async function placesOf(ownerAdminId, learnerId) {
  const hubs = new Map((await LearningHubModel.findAll({ ownerAdminId, includeDrafts: true })).map((h) => [h.id, h]));
  const links = (await LearnerHubLinkModel.findByLearnerId(learnerId)).filter((l) => hubs.has(l.hubId) && !hubs.get(l.hubId).isHomeLearning);
  const classIds = [...new Set(links.map((l) => l.classId).filter(Boolean))];
  const classes = new Map((classIds.length ? await db("classes").whereIn("id", classIds).select("id", "gradeName", "streamName") : []).map((c) => [c.id, c]));
  const runs = links.length ? await db("bootcamp_hubs").whereIn("hubId", links.map((l) => l.hubId)).select("bootcampId", "hubId", "classIds") : [];
  const bootcampIds = [...new Set(runs.map((r) => r.bootcampId))];
  const bootcamps = new Map((bootcampIds.length ? await db("bootcamps").whereIn("id", bootcampIds).select("id", "name") : []).map((b) => [b.id, b]));
  const bootcampOf = (link) => {
    if (!link.classId) return null;
    const run = runs.find((r) => r.hubId === link.hubId && String(r.classIds || "").includes(link.classId));
    return run ? bootcamps.get(run.bootcampId)?.name || "A bootcamp" : null;
  };
  return links.map((l) => {
    const cls = classes.get(l.classId);
    return {
      hubId: l.hubId,
      hubName: hubs.get(l.hubId)?.name || "A hub",
      className: cls ? [cls.gradeName, cls.streamName].filter(Boolean).join(" ") : null,
      bootcamp: bootcampOf(l),
      status: l.status || "active",
    };
  });
}

async function openInvoices(learnerId) {
  const rows = await db("billing_invoices").whereIn("status", OPEN_INVOICE)
    .where((w) => w.where({ learnerId }).orWhereIn("id", db("billing_invoice_items").where({ learnerId }).select("invoiceId")))
    .select("id", "invoiceNumber", "total", "amountPaid", "currency");
  return rows.map((r) => ({ id: r.id, invoiceNumber: r.invoiceNumber, owed: Math.max(0, Number(r.total || 0) - Number(r.amountPaid || 0)), currency: r.currency || "KES" }))
    .filter((r) => r.owed > 0);
}

const HomeLearningMove = {
  // What the move window shows: where the child is now, the family's households, what's owed.
  async options(req, learnerId) {
    const ownerAdminId = req.ownerAdminId;
    const learner = await loadLearner(ownerAdminId, learnerId);
    const current = await homeLearningPlace(ownerAdminId, learner.id);
    const households = learner.guardianEmail
      ? (await HouseholdModel.findByGuardianEmail(learner.guardianEmail)).filter((h) => h.ownerAdminId === ownerAdminId && h.status !== "cancelled")
      : [];
    const withPlaces = await Promise.all(households.map(async (h) => ({
      id: h.id, guardianName: h.guardianName, guardianEmail: h.guardianEmail, status: h.status, packageId: h.packageId,
      childCount: Number(h.childCount || 0), activeChildren: await HouseholdModel.countActive(h.id, ownerAdminId),
    })));
    return {
      learner: {
        id: learner.id, firstName: learner.firstName, lastName: learner.lastName, accountStatus: learner.accountStatus || "active",
        guardianName: learner.guardianName || "", guardianEmail: learner.guardianEmail || "", guardianPhone: learner.guardianPhone || "",
      },
      alreadyInHomeLearning: current ? { householdId: current.householdId, status: current.status } : null,
      places: await placesOf(ownerAdminId, learner.id),
      households: withPlaces,
      openInvoices: await openInvoices(learner.id),
    };
  },

  // { householdId } or { household: {…the household form} }, { enrollment: { curriculumId, gradeId,
  // educatorId } }, { endHubIds: [the places they leave] }.
  async move(req, learnerId, input = {}) {
    const ownerAdminId = req.ownerAdminId;
    const HomeLearningService = require("./home-learning.service");
    const { assertOwnCurriculum, resolveGrade, assertOwnEducator, ensureHomeHub } = internal();
    const learner = await loadLearner(ownerAdminId, learnerId);
    if (await homeLearningPlace(ownerAdminId, learner.id)) fail("They're already in Home Learning — change their place from the Home Learning page");

    // Everything checked before anything is written.
    const enrollment = enrollmentSchema.omit({ learnerId: true, status: true }).safeParse(input.enrollment || {});
    if (!enrollment.success) fail(enrollment.error.issues[0]?.message || "Choose a curriculum and grade");
    const curriculum = await assertOwnCurriculum(ownerAdminId, enrollment.data.curriculumId);
    resolveGrade(curriculum, enrollment.data.gradeId);
    await assertOwnEducator(ownerAdminId, enrollment.data.educatorId || null);
    const places = await placesOf(ownerAdminId, learner.id);
    const endHubIds = [...new Set(Array.isArray(input.endHubIds) ? input.endHubIds : [])];
    for (const hubId of endHubIds) if (!places.some((p) => p.hubId === hubId)) fail("They don't have a place at one of the hubs chosen to leave", 400);

    let household = null;
    let created = false;
    if (input.householdId) {
      household = await HouseholdModel.findById(input.householdId, ownerAdminId);
      if (!household || household.status === "cancelled") fail("Household not found", 404);
      if ((await HouseholdModel.countActive(household.id, ownerAdminId)) >= Number(household.childCount || 0)) {
        fail("That household has no free child place — raise its number of children on the Home Learning page first");
      }
    } else {
      // The parent's details come from the child's record, so their one login sees both programmes.
      const h = input.household || {};
      household = await HomeLearningService.create(ownerAdminId, {
        ...h,
        guardianName: h.guardianName || learner.guardianName,
        guardianEmail: h.guardianEmail ?? learner.guardianEmail ?? "",
        guardianPhone: h.guardianPhone || learner.guardianPhone,
      });
      created = true;
    }

    // The child's place is active; it only takes effect while the household is (syncHouseholdChildren).
    const status = "active";
    try {
      await HomeLearningService.setEnrollment(ownerAdminId, household.id, {
        learnerId: learner.id, curriculumId: enrollment.data.curriculumId, gradeId: enrollment.data.gradeId,
        educatorId: enrollment.data.educatorId || "", status,
      });
    } catch (err) {
      // A household made for this move and left empty goes again, so a refused move leaves nothing.
      if (created && !(await HouseholdModel.findEnrollmentsByHousehold(household.id, ownerAdminId)).length) {
        await db("home_learning_households").where({ id: household.id, ownerAdminId }).del();
      }
      throw err;
    }

    // The places they leave: ended (inactive), never deleted, each written down as a transfer.
    const hub = await ensureHomeHub(ownerAdminId);
    const place = await HouseholdModel.findEnrollment(household.id, learner.id, ownerAdminId);
    const ended = [];
    for (const hubId of endHubIds) {
      const link = await LearnerHubLinkModel.findOne(learner.id, hubId);
      if (!link) continue;
      await LearnerHubLinkModel.update(link.id, { status: "inactive" });
      await db("learner_transfers").insert({
        id: generateId(), learnerId: learner.id, fromHubId: hubId, toHubId: hub.id, fromClassId: link.classId || null, toClassId: place?.classId || null,
        fromAdmissionNumber: link.admissionNumber || null, transferredBy: req.user.id, notes: "Moved to Home Learning", createdAt: new Date(),
      });
      ended.push(hubId);
    }
    // An account switched off (not one waiting for payment — billing decides those) comes back on
    // with a Home Learning place in an active household.
    if (household.status === "active" && (learner.accountStatus || "active") === "inactive") {
      await LearnerModel.update(learner.id, { accountStatus: "active" });
    }
    return { householdId: household.id, createdHousehold: created, householdStatus: household.status, ended };
  },
};

module.exports = HomeLearningMove;
