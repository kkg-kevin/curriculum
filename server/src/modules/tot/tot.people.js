const db = require("../../config/db");

// Where an educator in training appears (5 Nov 2026), by the same rule as how they sign in
// (auth/account-roles.js's TOT_LEARNER_ROLE):
//   - educator only (no learner record of their own)     → educator lists only;
//   - educator AND TOT learner (Active, with an active place in a TOT class) → educator lists and
//     Learners → TOT learners (an Active educator withdrawn from every TOT class is educator only);
//   - TOT learner only (still "in_training", with a record) → Learners → TOT learners only — left out
//     of the educator lists (admin Educators, a hub's educators, dashboards' educator counts).
// Their educator page still opens by its address (the TOT learners card links to it — Make Active
// is there).

// Whether this learner record holds an active place in a TOT class (a class of a curriculum for
// educators) — what makes an Active educator ALSO a TOT learner. Withdrawn from every TOT class (or
// never placed), an Active educator is an educator only: no TOT learner sign-in, nothing to switch to.
async function hasActiveTotPlace(learnerId) {
  if (!learnerId) return false;
  return !!(await db("learner_hub_links as l")
    .join("classes as c", "c.id", "l.classId")
    .join("curricula as cu", "cu.id", "c.curriculumId")
    .where({ "l.learnerId": learnerId, "l.status": "active", "cu.audience": "educators" })
    .first("l.id"));
}

// Of these educators (all, when null), the ids that are TOT learners only.
async function totOnlyTeacherIds(teacherIds = null) {
  if (Array.isArray(teacherIds) && teacherIds.length === 0) return new Set();
  const q = db("teachers as t").join("learners as l", "l.teacherId", "t.id").where("t.status", "in_training");
  if (teacherIds) q.whereIn("t.id", teacherIds);
  return new Set((await q.distinct("t.id")).map((r) => r.id));
}

// The educators without those who are TOT learners only.
async function withoutTotOnly(teachers) {
  const totOnly = await totOnlyTeacherIds(teachers.map((t) => t.id));
  return totOnly.size ? teachers.filter((t) => !totOnly.has(t.id)) : teachers;
}

module.exports = { hasActiveTotPlace, totOnlyTeacherIds, withoutTotOnly };
