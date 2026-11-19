const asyncHandler = require("express-async-handler");
const db = require("../../config/db");
const SessionCoverService = require("./session-cover.service");
const { assertOwn, isOwnHub } = require("../../shared/middleware/scope.middleware");
const { sessionRefSchema, requestCoverSchema, respondSchema, cancelSchema, attendanceSchema, taughtSchema } = require("./session-cover.validation");

// Session covers (19 Nov 2026) — see session-cover.service.js.
//   class side   the class's educators of that course, its hub, the workspace's admins/staff:
//                ask for a cover, see the candidates, cancel;
//   cover side   the educator asked: accept / decline / withdraw, and the cover page (that class on
//                that date only — attendance and "taught").

async function adminHubIds(req) {
  return db("learning_hubs").where({ ownerAdminId: req.ownerAdminId }).pluck("id");
}

async function loadClass(classId) {
  const cls = await db("classes").where({ id: classId }).first("id", "schoolId", "gradeName", "streamName", "curriculumId");
  if (!cls) throw Object.assign(new Error("Class not found"), { statusCode: 404 });
  const hub = cls.schoolId ? await db("learning_hubs").where({ id: cls.schoolId }).first("id", "ownerAdminId") : null;
  return { cls, ownerAdminId: hub?.ownerAdminId || null };
}

// The class's side: an educator of THIS course in the class, the class's hub, or an admin of its
// workspace. Returns who is acting.
async function classSideActor(req, cls, courseId) {
  if (req.user.role === "teacher") {
    const teaching = await db("class_course_teacher_links").where({ classId: cls.id, courseId, teacherId: req.ownTeacher?.id || "" }).first("id");
    assertOwn(Boolean(teaching));
    return { kind: "educator", userId: req.user.id, teacherId: req.ownTeacher.id };
  }
  if (req.user.role === "school") {
    assertOwn(isOwnHub(req, cls.schoolId));
    return { kind: "hub", userId: req.user.id };
  }
  if (req.user.role === "admin") {
    assertOwn((await adminHubIds(req)).includes(cls.schoolId));
    return { kind: "admin", userId: req.user.id };
  }
  assertOwn(false);
  return null;
}

const candidates = asyncHandler(async (req, res) => {
  const ref = sessionRefSchema.parse(req.query);
  const { cls, ownerAdminId } = await loadClass(ref.classId);
  await classSideActor(req, cls, ref.courseId);
  res.json({ success: true, data: await SessionCoverService.candidates({ cls, ...ref, ownerAdminId }) });
});

const requestCover = asyncHandler(async (req, res) => {
  const body = requestCoverSchema.parse(req.body);
  const { cls, ownerAdminId } = await loadClass(body.classId);
  const actor = await classSideActor(req, cls, body.courseId);
  const data = await SessionCoverService.request({ cls, ...body, actor, ownerAdminId });
  res.status(201).json({ success: true, data });
});

const myCovers = asyncHandler(async (req, res) => {
  if (!req.ownTeacher) return res.json({ success: true, data: { forMe: [], forMyClasses: [] } });
  res.json({ success: true, data: await SessionCoverService.listForTeacher(req.ownTeacher.id) });
});

// Hub / admin overview.
const listCovers = asyncHandler(async (req, res) => {
  const hubIds = req.user.role === "school" ? (req.ownSchools || (req.ownSchool ? [req.ownSchool] : [])).map((h) => h.id) : await adminHubIds(req);
  res.json({ success: true, data: await SessionCoverService.listForHubs(hubIds) });
});

const respond = asyncHandler(async (req, res) => {
  const { decision, reason } = respondSchema.parse(req.body);
  if (!req.ownTeacher) assertOwn(false);
  res.json({ success: true, data: await SessionCoverService.respond({ id: req.params.id, teacherId: req.ownTeacher.id, decision, reason }) });
});

// The cover educator withdraws; anyone on the class's side cancels.
const cancel = asyncHandler(async (req, res) => {
  const { reason } = cancelSchema.parse(req.body || {});
  const { cover } = await SessionCoverService.getForClassSide(req.params.id);
  const byCoverEducator = req.user.role === "teacher" && req.ownTeacher?.id === cover.coverTeacherId;
  if (!byCoverEducator) {
    const { cls } = await loadClass(cover.classId);
    const isOriginal = req.user.role === "teacher" && req.ownTeacher?.id === cover.originalTeacherId;
    if (!isOriginal) await classSideActor(req, cls, cover.courseId);
  }
  res.json({ success: true, data: await SessionCoverService.cancel({ id: req.params.id, byUserId: req.user.id, byCoverEducator, reason }) });
});

const coverPage = asyncHandler(async (req, res) => {
  if (!req.ownTeacher) assertOwn(false);
  res.json({ success: true, data: await SessionCoverService.coverPage({ id: req.params.id, teacherId: req.ownTeacher.id }) });
});

const markAttendance = asyncHandler(async (req, res) => {
  const { records } = attendanceSchema.parse(req.body);
  if (!req.ownTeacher) assertOwn(false);
  res.json({ success: true, data: await SessionCoverService.markAttendance({ id: req.params.id, teacherId: req.ownTeacher.id, records }) });
});

const markTaught = asyncHandler(async (req, res) => {
  const { note } = taughtSchema.parse(req.body || {});
  if (!req.ownTeacher) assertOwn(false);
  res.json({ success: true, data: await SessionCoverService.markTaught({ id: req.params.id, teacherId: req.ownTeacher.id, note }) });
});

module.exports = { candidates, requestCover, myCovers, listCovers, respond, cancel, coverPage, markAttendance, markTaught };
