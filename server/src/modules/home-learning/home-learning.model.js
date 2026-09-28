const db = require("../../config/db");
const { createRecord, updateRecord, firstOrNull } = require("../../shared/utils/model.utils");

const HOUSEHOLDS = "home_learning_households";
const ENROLLMENTS = "home_learning_enrollments";

const learnerSummary = (l) => (l ? { id: l.id, firstName: l.firstName, lastName: l.lastName, gender: l.gender, photo: l.photo, registrationNumber: l.registrationNumber } : null);
const personSummary = (p) => (p ? { id: p.id, firstName: p.firstName, lastName: p.lastName, photo: p.photo } : null);
const byId = (rows) => new Map(rows.map((row) => [row.id, row]));
const idsOf = (rows, key) => [...new Set(rows.map((row) => row[key]).filter(Boolean))];

async function lookup(table, ids) {
  return byId(ids.length ? await db(table).whereIn("id", ids) : []);
}

// Active enrollments whose household is also active — the only ones that grant portal access.
// Joined in SQL (ownerAdminId on both sides, so a household can never leak across tenants).
function activeEnrollmentsQuery() {
  return db(`${ENROLLMENTS} as e`)
    .join(`${HOUSEHOLDS} as h`, function joinHousehold() {
      this.on("h.id", "=", "e.householdId").andOn("h.ownerAdminId", "=", "e.ownerAdminId");
    })
    .where("e.status", "active")
    .andWhere("h.status", "active");
}

const HouseholdModel = {
  async findAll(ownerAdminId) {
    const households = await db(HOUSEHOLDS).where({ ownerAdminId }).orderBy("createdAt", "desc");
    if (!households.length) return [];
    const links = await db(ENROLLMENTS)
      .where({ ownerAdminId })
      .whereIn("householdId", households.map((h) => h.id))
      .orderBy("createdAt", "asc");
    const [learners, curricula, educators] = await Promise.all([
      lookup("learners", idsOf(links, "learnerId")),
      lookup("curricula", idsOf(links, "curriculumId")),
      lookup("teachers", idsOf(links, "educatorId")),
    ]);
    return households.map((household) => ({
      ...household,
      learners: links.filter((l) => l.householdId === household.id).map((link) => {
        const curriculum = curricula.get(link.curriculumId);
        return {
          ...link,
          learner: learnerSummary(learners.get(link.learnerId)),
          curriculum: curriculum ? { id: curriculum.id, name: curriculum.name } : null,
          educator: personSummary(educators.get(link.educatorId)),
        };
      }),
    }));
  },

  findById(id, ownerAdminId) {
    return firstOrNull(db(HOUSEHOLDS).where({ id, ownerAdminId }));
  },

  findEnrollment(householdId, learnerId, ownerAdminId) {
    return firstOrNull(db(ENROLLMENTS).where({ householdId, learnerId, ownerAdminId }));
  },

  findEnrollmentsByLearner(learnerId) {
    return db(ENROLLMENTS).where({ learnerId });
  },

  findEnrollmentsByHousehold(householdId, ownerAdminId) {
    return db(ENROLLMENTS).where({ householdId, ownerAdminId });
  },

  async countActive(householdId, ownerAdminId) {
    const row = await db(ENROLLMENTS).where({ householdId, ownerAdminId, status: "active" }).count({ count: "*" }).first();
    return Number(row?.count || 0);
  },

  async findForLearner(learnerId) {
    if (!learnerId) return [];
    const links = await activeEnrollmentsQuery()
      .where("e.learnerId", learnerId)
      .select("e.*", "h.guardianName")
      .orderBy("e.createdAt", "desc");
    const [curricula, educators] = await Promise.all([
      lookup("curricula", idsOf(links, "curriculumId")),
      lookup("teachers", idsOf(links, "educatorId")),
    ]);
    return links.map(({ guardianName, ...link }) => ({
      ...link,
      household: { id: link.householdId, guardianName },
      curriculum: curricula.get(link.curriculumId) || null,
      educator: personSummary(educators.get(link.educatorId)),
    }));
  },

  async findCurriculaForEducator(educatorId) {
    if (!educatorId) return [];
    const rows = await activeEnrollmentsQuery().where("e.educatorId", educatorId).distinct("e.curriculumId");
    return rows.map((row) => row.curriculumId);
  },

  // Every learner this admin has EVER enrolled in Home Learning, removed ones included — a removed
  // child stays in the workspace (and can be re-added) instead of silently dropping out of it.
  async findLearnerIds(ownerAdminId) {
    const rows = await db(ENROLLMENTS).where({ ownerAdminId }).distinct("learnerId");
    return rows.map((row) => row.learnerId);
  },

  async findAssignmentsForEducator(educatorId) {
    if (!educatorId) return [];
    const links = await activeEnrollmentsQuery()
      .where("e.educatorId", educatorId)
      .select(
        "e.*", "h.guardianName", "h.guardianPhone", "h.guardianEmail", "h.county", "h.subCounty",
        "h.town", "h.addressLine", "h.landmark",
      )
      .orderBy("e.createdAt", "desc");
    const [learners, curricula] = await Promise.all([
      lookup("learners", idsOf(links, "learnerId")),
      lookup("curricula", idsOf(links, "curriculumId")),
    ]);
    return links.map((link) => {
      const curriculum = curricula.get(link.curriculumId);
      return {
        id: link.id,
        classId: link.classId || null,
        gradeId: link.gradeId || null,
        gradeName: link.gradeName || null,
        learner: personSummary(learners.get(link.learnerId)),
        curriculum: curriculum ? { id: curriculum.id, name: curriculum.name } : null,
        household: {
          guardianName: link.guardianName,
          guardianPhone: link.guardianPhone,
          guardianEmail: link.guardianEmail,
          county: link.county,
          subCounty: link.subCounty,
          town: link.town,
          addressLine: link.addressLine,
          landmark: link.landmark,
        },
      };
    });
  },

  // Households a guardian login can see invoices for (matched on the guardian's email).
  findByGuardianEmail(email) {
    if (!email) return [];
    return db(HOUSEHOLDS).whereRaw("LOWER(guardianEmail) = ?", [email.toLowerCase()]);
  },

  createHousehold(data) {
    return createRecord(db, HOUSEHOLDS, data);
  },

  async updateHousehold(id, ownerAdminId, data) {
    const existing = await firstOrNull(db(HOUSEHOLDS).where({ id, ownerAdminId }));
    if (!existing) return null;
    await updateRecord(db, HOUSEHOLDS, id, data);
    return firstOrNull(db(HOUSEHOLDS).where({ id, ownerAdminId }));
  },

  createEnrollment(data) {
    return createRecord(db, ENROLLMENTS, data);
  },

  async updateEnrollment(id, data) {
    await updateRecord(db, ENROLLMENTS, id, data);
    return firstOrNull(db(ENROLLMENTS).where({ id }));
  },

  deleteEnrollmentsByLearner(learnerId) {
    return db(ENROLLMENTS).where({ learnerId }).del();
  },

  findHomeHub(ownerAdminId) {
    return firstOrNull(db("learning_hubs").where({ ownerAdminId, isHomeLearning: true }));
  },
};

module.exports = HouseholdModel;
