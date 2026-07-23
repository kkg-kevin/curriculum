const asyncHandler = require("express-async-handler");
const LearnerService = require("./learner.service");
const AuthService = require("../auth/auth.service");
const LearnerHubLinkModel = require("./learner-hub-link.model");
const { createLearnerSchema, updateLearnerSchema, enrollLearnerSchema, updateEnrollmentSchema } = require("./learner.validation");
const { assertOwn } = require("../../shared/middleware/scope.middleware");
const ClassModel = require("../classes/class.model");

// A learner belongs to a class, and a class belongs to a teacher — this is the only place a
// teacher's access to a learner is decided, so both getAllLearners and getLearnerById go through it.
function classTaughtByTeacher(classId, teacherId) {
  if (!classId) return false;
  const cls = ClassModel.findById(classId);
  return !!cls && cls.classTeacherId === teacherId;
}

// True whenever `learnerId` has an enrollment link at `hubId` — the membership test a
// "school"-role caller needs to prove a learner belongs to its own hub. Same pattern as
// teacher.controller.js's `isLinkedToHub`.
function isLinkedToHub(learnerId, hubId) {
  return LearnerHubLinkModel.findByLearnerId(learnerId).some((l) => l.hubId === hubId);
}

// True whenever any of `learnerId`'s enrollment links puts them in a class this teacher
// teaches — a learner can now have several enrollments, so this is an "any", not the old
// single-classId equality check.
function anyEnrollmentTaughtByTeacher(learnerId, teacherId) {
  return LearnerHubLinkModel.findByLearnerId(learnerId).some((l) => classTaughtByTeacher(l.classId, teacherId));
}

const createLearner = asyncHandler(async (req, res) => {
  const { hubId, classId } = req.body;
  const { password, ...data } = createLearnerSchema.parse(req.body);
  // Create the login first — if it fails (e.g. the email already belongs to a different-role
  // account), nothing is written at all, rather than leaving a learner record with no login.
  if (password) {
    await AuthService.setOrCreatePassword({ name: data.guardianName, email: data.guardianEmail, password, role: "learner" });
  }
  const record = await LearnerService.createLearner(data);
  // A learner is never linked to a hub as part of its own identity — hubId here is purely an
  // optional one-shot convenience (e.g. "Enroll Learner" clicked from within a school's own
  // page), a second write after the learner already exists, same as createTeacher.
  let linkHubId = hubId || undefined;
  if (req.user.role === "school") linkHubId = req.ownSchool?.id;
  if (linkHubId) await LearnerService.enrollInHub(record.id, { hubId: linkHubId, classId: classId || "", status: "active" });
  res.status(201).json({ success: true, data: record });
});

const getAllLearners = asyncHandler(async (req, res) => {
  const { schoolId, classId, status, guardianEmail } = req.query;
  const filters = { schoolId, classId, status, guardianEmail };
  if (req.user.role === "school") {
    if (!req.ownSchool) return res.json({ success: true, data: [], count: 0 });
    filters.schoolId = req.ownSchool.id;
  } else if (req.user.role === "teacher") {
    if (!req.ownTeacher || !classTaughtByTeacher(classId, req.ownTeacher.id)) {
      return res.json({ success: true, data: [], count: 0 });
    }
  } else if (req.user.role === "learner") {
    if (!req.ownLearner) return res.json({ success: true, data: [], count: 0 });
    filters.guardianEmail = req.ownLearner.guardianEmail;
  }
  const records = await LearnerService.getAllLearners(filters);
  res.json({ success: true, data: records, count: records.length });
});

const getLearnerById = asyncHandler(async (req, res) => {
  const record = await LearnerService.getLearnerById(req.params.id);
  if (req.user.role === "school")  assertOwn(isLinkedToHub(record.id, req.ownSchool?.id));
  if (req.user.role === "teacher") assertOwn(anyEnrollmentTaughtByTeacher(record.id, req.ownTeacher?.id));
  if (req.user.role === "learner") assertOwn(record.id === req.ownLearner?.id);
  res.json({ success: true, data: record });
});

const updateLearner = asyncHandler(async (req, res) => {
  const { password, ...data } = updateLearnerSchema.parse(req.body);
  if (req.user.role === "school") {
    const existing = await LearnerService.getLearnerById(req.params.id);
    assertOwn(isLinkedToHub(existing.id, req.ownSchool?.id));
  }
  const record = await LearnerService.updateLearner(req.params.id, data);
  if (password) {
    if (!record.guardianEmail) {
      const err = new Error("This learner needs a guardian email before a password can be set");
      err.statusCode = 400;
      throw err;
    }
    await AuthService.setOrCreatePassword({ name: record.guardianName, email: record.guardianEmail, password, role: "learner" });
  }
  res.json({ success: true, data: record });
});

// True delete is admin-only (see learner.routes.js) — a "school" losing access to a learner
// shared with another hub must unenroll (DELETE /:id/hubs/links/:hubId), never destroy the
// underlying record, same split as teacher.controller.js.
const deleteLearner = asyncHandler(async (req, res) => {
  const result = await LearnerService.deleteLearner(req.params.id);
  res.json({ success: true, ...result });
});

const getLearnerHubs = asyncHandler(async (req, res) => {
  if (req.user.role === "learner") assertOwn(req.params.id === req.ownLearner?.id);
  let hubs = await LearnerService.getLearnerHubs(req.params.id);
  if (req.user.role === "school") {
    assertOwn(isLinkedToHub(req.params.id, req.ownSchool?.id));
    // A school only ever gets to see its own hub in the list — not the names of any other
    // hub a shared learner also happens to attend.
    hubs = hubs.filter((h) => h.id === req.ownSchool.id);
  } else if (req.user.role === "teacher") {
    assertOwn(anyEnrollmentTaughtByTeacher(req.params.id, req.ownTeacher?.id));
  }
  res.json({ success: true, data: hubs, count: hubs.length });
});

const enrollLearnerHub = asyncHandler(async (req, res) => {
  const data = enrollLearnerSchema.parse(req.body);
  if (req.user.role === "school") assertOwn(data.hubId === req.ownSchool?.id);
  const hubs = await LearnerService.enrollInHub(req.params.id, data);
  res.status(201).json({ success: true, data: hubs });
});

const updateLearnerHubLink = asyncHandler(async (req, res) => {
  const data = updateEnrollmentSchema.parse(req.body);
  if (req.user.role === "school") assertOwn(req.params.hubId === req.ownSchool?.id);
  const hubs = await LearnerService.updateEnrollment(req.params.id, req.params.hubId, data);
  res.json({ success: true, data: hubs });
});

const unenrollLearnerHub = asyncHandler(async (req, res) => {
  if (req.user.role === "school") assertOwn(req.params.hubId === req.ownSchool?.id);
  const hubs = await LearnerService.unenrollFromHub(req.params.id, req.params.hubId);
  res.json({ success: true, data: hubs });
});

module.exports = {
  createLearner,
  getAllLearners,
  getLearnerById,
  updateLearner,
  deleteLearner,
  getLearnerHubs,
  enrollLearnerHub,
  updateLearnerHubLink,
  unenrollLearnerHub,
};
