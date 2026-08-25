const asyncHandler = require("express-async-handler");
const TeacherService = require("./teacher.service");
const AuthService = require("../auth/auth.service");
const TeacherHubLinkModel = require("./teacher-hub-link.model");
const TeacherAvailabilityModel = require("./teacher-availability.model");
const LearnerHubLinkModel = require("../learners/learner-hub-link.model");
const ClassCourseTeacherLinkModel = require("../classes/class-course-teacher-link.model");
const { createTeacherSchema, updateTeacherSchema, createAvailabilitySlotSchema, updateAvailabilitySlotSchema } = require("./teacher.validation");
const { assertOwn, isOwnHub } = require("../../shared/middleware/scope.middleware");

// True whenever `teacherId` is linked to `hubId` via the teacher-hub link table — the
// membership test that replaced the old single teacher.schoolId equality check everywhere
// a "school"-role caller needs to prove a teacher belongs to their own hub.
async function isLinkedToHub(teacherId, hubId) {
  const links = await TeacherHubLinkModel.findByTeacherId(teacherId);
  return links.some((l) => l.hubId === hubId);
}

// Same membership test, scoped to a "school" account's currently active hub (see
// scope.middleware.js's req.ownSchool — a parent hub's admin switching into a branch hub gets
// this for free, no change needed here).
async function isLinkedToOwnHub(req, teacherId) {
  if (req.user.role === "school") return isLinkedToHub(teacherId, req.ownSchool?.id);
  return false;
}

// True whenever `teacherId` has a course-educator link in any class the learner is currently
// enrolled in — the read-only counterpart to isLinkedToHub above, letting a learner see
// one of their own educators' basic info without opening up arbitrary teacher lookups.
async function isMyClassTeacher(teacherId, learnerId) {
  const links = await LearnerHubLinkModel.findByLearnerId(learnerId);
  const classIds = links.map((l) => l.classId).filter(Boolean);
  const results = await Promise.all(
    classIds.map(async (classId) => {
      const courseLinks = await ClassCourseTeacherLinkModel.findByClassId(classId);
      return courseLinks.some((link) => link.teacherId === teacherId);
    })
  );
  return results.some(Boolean);
}

const createTeacher = asyncHandler(async (req, res) => {
  const { hubId } = req.body;
  const { password, ...data } = createTeacherSchema.parse(req.body);
  let linkHubId = hubId || undefined;
  if (req.user.role === "school") {
    assertOwn(!!req.ownSchool);
    linkHubId = req.ownSchool.id;
  }
  // Create the login first — if it fails (e.g. the email already belongs to a different-role
  // account), nothing is written at all, rather than leaving a teacher record with no login.
  if (password) {
    await AuthService.setOrCreatePassword({ name: `${data.firstName} ${data.lastName}`, email: data.email, password, role: "teacher" });
  }
  const teacher = await TeacherService.createTeacher(data);
  if (linkHubId) await TeacherService.linkHub(teacher.id, linkHubId);
  res.status(201).json({ success: true, data: teacher });
});

const getAllTeachers = asyncHandler(async (req, res) => {
  const { status, subject, email } = req.query;
  const filters = { status, subject, email };
  if (req.user.role === "school") {
    if (!req.ownSchool) return res.json({ success: true, data: [], count: 0 });
    filters.ids = (await TeacherHubLinkModel.findByHubId(req.ownSchool.id)).map((l) => l.teacherId);
  } else if (req.user.role === "teacher") {
    if (!req.ownTeacher) return res.json({ success: true, data: [], count: 0 });
    filters.email = req.ownTeacher.email;
  }
  const teachers = await TeacherService.getAllTeachers(filters);
  res.json({ success: true, data: teachers, count: teachers.length });
});

const getTeacherById = asyncHandler(async (req, res) => {
  const teacher = await TeacherService.getTeacherById(req.params.id);
  if (req.user.role === "school") assertOwn(await isLinkedToOwnHub(req, teacher.id));
  if (req.user.role === "teacher") assertOwn(teacher.id === req.ownTeacher?.id);
  if (req.user.role === "learner") assertOwn(await isMyClassTeacher(teacher.id, req.ownLearner?.id));
  res.json({ success: true, data: teacher });
});

// Self-service fields a teacher may change on their own record — deliberately excludes email
// and status: email doubles as the login-matching key (changing it here would disconnect the
// account from this very record), and status/hub-links are admin/school-controlled identity/
// assignment fields, not "my profile" fields. name/phone/photo are plain profile info, same
// posture as LEARNER_SELF_EDIT_FIELDS in learner.controller.js. `password` is handled
// separately below (not in this list) — a teacher resetting their own login password is
// safe to allow since it can't touch email/role, unlike everything else this list guards
// against. Hub assignment itself never goes through this route at all (see the dedicated
// /hubs/links routes, which are never authorized for the "teacher" role) — this allowlist is
// a second layer of defense, not the only one.
const TEACHER_SELF_EDIT_FIELDS = ["firstName", "lastName", "phone", "photo"];

const updateTeacher = asyncHandler(async (req, res) => {
  const parsed = updateTeacherSchema.parse(req.body);
  // .partial() still materializes each field's .default(...) when it's absent from the request
  // body (e.g. status defaults back to "active", phone to "") — same bug class already fixed in
  // learner.controller.js/learning-hub.controller.js. Only keys the caller actually sent survive.
  const present = Object.fromEntries(Object.entries(parsed).filter(([key]) => key in req.body));
  const { password, ...data } = present;
  if (req.user.role === "school") {
    const existing = await TeacherService.getTeacherById(req.params.id);
    assertOwn(await isLinkedToOwnHub(req, existing.id));
  } else if (req.user.role === "teacher") {
    assertOwn(req.params.id === req.ownTeacher?.id);
    Object.keys(data).forEach((key) => {
      if (!TEACHER_SELF_EDIT_FIELDS.includes(key)) delete data[key];
    });
  }
  const teacher = await TeacherService.updateTeacher(req.params.id, data);
  if (password) {
    if (!teacher.email) {
      const err = new Error("This teacher needs an email address before a password can be set");
      err.statusCode = 400;
      throw err;
    }
    await AuthService.setOrCreatePassword({ name: `${teacher.firstName} ${teacher.lastName}`, email: teacher.email, password, role: "teacher" });
  }
  res.json({ success: true, data: teacher });
});

// True delete is admin-only (see teacher.routes.js) — a "school" losing access to a teacher
// shared with another hub must unlink (DELETE /:id/hubs/links/:hubId), never destroy the
// underlying record.
const deleteTeacher = asyncHandler(async (req, res) => {
  const result = await TeacherService.deleteTeacher(req.params.id);
  res.json({ success: true, ...result });
});

const getTeacherHubs = asyncHandler(async (req, res) => {
  if (req.user.role === "teacher") assertOwn(req.params.id === req.ownTeacher?.id);
  let hubs = await TeacherService.getTeacherHubs(req.params.id);
  if (req.user.role === "school") {
    assertOwn(await isLinkedToOwnHub(req, req.params.id));
    // A school only ever gets to see its own hub(s) in the list — not the names of any other
    // hub a shared teacher also happens to teach at.
    hubs = hubs.filter((h) => isOwnHub(req, h.id));
  }
  res.json({ success: true, data: hubs, count: hubs.length });
});

const linkTeacherHub = asyncHandler(async (req, res) => {
  const { hubId } = req.body;
  if (req.user.role === "school") assertOwn(isOwnHub(req, hubId));
  const hubs = await TeacherService.linkHub(req.params.id, hubId);
  res.status(201).json({ success: true, data: hubs });
});

const unlinkTeacherHub = asyncHandler(async (req, res) => {
  if (req.user.role === "school") assertOwn(isOwnHub(req, req.params.hubId));
  const hubs = await TeacherService.unlinkHub(req.params.id, req.params.hubId);
  res.json({ success: true, data: hubs });
});

// A teacher's own "here's when I can teach" weekly windows — same ownership posture as
// hubs/links above: "teacher" only ever reads/writes its own, "school" only a teacher linked to
// its own hub, "admin" unrestricted. Read is open to "school" too (not just admin/self) so a
// school can check a teacher's availability before assigning them to a timetable slot.
const getTeacherAvailability = asyncHandler(async (req, res) => {
  if (req.user.role === "teacher") assertOwn(req.params.id === req.ownTeacher?.id);
  if (req.user.role === "school") assertOwn(await isLinkedToOwnHub(req, req.params.id));
  const slots = await TeacherService.getAvailability(req.params.id);
  res.json({ success: true, data: slots, count: slots.length });
});

const addTeacherAvailabilitySlot = asyncHandler(async (req, res) => {
  if (req.user.role === "teacher") assertOwn(req.params.id === req.ownTeacher?.id);
  if (req.user.role === "school") assertOwn(await isLinkedToOwnHub(req, req.params.id));
  const data = createAvailabilitySlotSchema.parse(req.body);
  const slot = await TeacherService.addAvailabilitySlot(req.params.id, data);
  res.status(201).json({ success: true, data: slot });
});

async function loadOwnedAvailabilitySlotOrThrow(req) {
  const slot = await TeacherAvailabilityModel.findById(req.params.slotId);
  if (!slot) {
    const err = new Error("Availability window not found");
    err.statusCode = 404;
    throw err;
  }
  if (req.user.role === "teacher") assertOwn(slot.teacherId === req.ownTeacher?.id);
  if (req.user.role === "school") assertOwn(await isLinkedToOwnHub(req, slot.teacherId));
  return slot;
}

const updateTeacherAvailabilitySlot = asyncHandler(async (req, res) => {
  await loadOwnedAvailabilitySlotOrThrow(req);
  const parsed = updateAvailabilitySlotSchema.parse(req.body);
  // Same "only keys present in the raw body survive" guard every partial-update endpoint in
  // this codebase needs (updateAvailabilitySlotSchema is createAvailabilitySlotSchema.partial(),
  // which still materializes an absent key's .default() if one existed).
  const data = Object.fromEntries(Object.entries(parsed).filter(([key]) => key in req.body));
  const slot = await TeacherService.updateAvailabilitySlot(req.params.slotId, data);
  res.json({ success: true, data: slot });
});

const deleteTeacherAvailabilitySlot = asyncHandler(async (req, res) => {
  await loadOwnedAvailabilitySlotOrThrow(req);
  const result = await TeacherService.deleteAvailabilitySlot(req.params.slotId);
  res.json({ success: true, ...result });
});

module.exports = {
  createTeacher,
  getAllTeachers,
  getTeacherById,
  updateTeacher,
  deleteTeacher,
  getTeacherHubs,
  linkTeacherHub,
  unlinkTeacherHub,
  getTeacherAvailability,
  addTeacherAvailabilitySlot,
  updateTeacherAvailabilitySlot,
  deleteTeacherAvailabilitySlot,
};
