// Past programmes (17 Nov 2026) — the classes a learner has been in before and is no longer in,
// each with what they earned there: course reports, certificates, and counts of session reports
// and marked work. Shown on the staff learner page and in the learner / parent portal, so earlier
// records are found in one place without switching hubs.
//
// A "past class" is any class the learner has a published report, an issued certificate, marked
// work or a Move out of — minus the classes they're in now. Worked out from the records, so it
// also covers classes left before Moves were recorded, or left by an edit rather than a Move.

const db = require("../../config/db");
const { classLabel } = require("./learner-move.places");

const json = (v) => {
  if (v == null || typeof v !== "string") return v;
  try { return JSON.parse(v); } catch { return null; }
};
const latest = (dates) => dates.filter(Boolean).map((d) => new Date(d)).sort((a, b) => b - a)[0] || null;

// hubIds: only classes at these hubs (a member of staff sees their own workspace / hub); null = all.
async function pastProgrammes(learnerId, hubIds = null) {
  const [links, reports, certificates, marked, moves] = await Promise.all([
    db("learner_hub_links").where({ learnerId }).select("classId", "status"),
    db("reports").where({ learnerId, status: "published" }).whereNotNull("classId").select("id", "classId", "courseId", "sessionId", "moduleId", "publishedAt"),
    db("certificates").where({ learnerId, status: "issued" }).whereNotNull("classId").select("id", "classId", "courseId", "kind", "certificateNumber", "snapshot", "issuedAt"),
    db("assessment_submissions").where({ learnerId, status: "graded" }).whereNotNull("classId").select("classId"),
    db("learner_transfers").where({ learnerId }).whereNotNull("fromClassId").orderBy("createdAt", "desc").select("fromClassId", "toLabel", "createdAt"),
  ]);
  const current = new Set(links.filter((l) => l.status === "active" && l.classId).map((l) => l.classId));
  const ids = new Set([...reports, ...certificates, ...marked].map((r) => r.classId));
  for (const m of moves) ids.add(m.fromClassId);
  for (const id of current) ids.delete(id);
  ids.delete("");
  if (!ids.size) return [];

  let classes = await db("classes").whereIn("id", [...ids]).select("id", "schoolId", "gradeName", "streamName", "curriculumId");
  if (hubIds) {
    const allowed = new Set(hubIds);
    classes = classes.filter((c) => allowed.has(c.schoolId));
  }
  if (!classes.length) return [];
  const classIds = new Set(classes.map((c) => c.id));
  const own = (rows) => rows.filter((r) => classIds.has(r.classId));
  const [hubs, curricula, courses] = await Promise.all([
    db("learning_hubs").whereIn("id", [...new Set(classes.map((c) => c.schoolId))]).select("id", "name"),
    db("curricula").whereIn("id", [...new Set(classes.map((c) => c.curriculumId).filter(Boolean))]).select("id", "name"),
    db("courses").whereIn("id", [...new Set([...own(reports), ...own(certificates)].map((r) => r.courseId).filter(Boolean))]).select("id", "name"),
  ]);
  const hubName = new Map(hubs.map((h) => [h.id, h.name]));
  const curriculumName = new Map(curricula.map((c) => [c.id, c.name]));
  const courseName = new Map(courses.map((c) => [c.id, c.name]));

  return classes.map((cls) => {
    const mine = (rows) => rows.filter((r) => r.classId === cls.id);
    const classReports = mine(reports);
    const classCertificates = mine(certificates);
    const move = moves.find((m) => m.fromClassId === cls.id) || null;
    const courseReports = classReports.filter((r) => !r.sessionId && !r.moduleId)
      .map((r) => ({ id: r.id, courseName: courseName.get(r.courseId) || "Course", publishedAt: r.publishedAt }))
      .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
    const certs = classCertificates.map((c) => {
      const snap = json(c.snapshot) || {};
      return { id: c.id, kind: c.kind, title: snap.title || snap.courseName || courseName.get(c.courseId) || "Certificate", certificateNumber: c.certificateNumber, issuedAt: c.issuedAt };
    }).sort((a, b) => new Date(b.issuedAt) - new Date(a.issuedAt));
    return {
      classId: cls.id,
      label: classLabel(cls),
      hubName: hubName.get(cls.schoolId) || "",
      curriculumName: curriculumName.get(cls.curriculumId) || "",
      leftAt: move?.createdAt || null,
      movedTo: move?.toLabel || null,
      lastActivityAt: latest([move?.createdAt, ...classReports.map((r) => r.publishedAt), ...classCertificates.map((c) => c.issuedAt)]),
      sessionReports: classReports.filter((r) => r.sessionId).length,
      moduleReports: classReports.filter((r) => !r.sessionId && r.moduleId).length,
      markedWork: mine(marked).length,
      courseReports,
      certificates: certs,
    };
  }).sort((a, b) => new Date(b.lastActivityAt || 0) - new Date(a.lastActivityAt || 0));
}

module.exports = { pastProgrammes };
