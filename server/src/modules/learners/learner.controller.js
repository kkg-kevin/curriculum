const asyncHandler = require("express-async-handler");
const LearnerService = require("./learner.service");
const AuthService = require("../auth/auth.service");
const LearnerHubLinkModel = require("./learner-hub-link.model");
const { createLearnerSchema, updateLearnerSchema, enrollLearnerSchema, updateEnrollmentSchema } = require("./learner.validation");
const { assertOwn, isOwnHub } = require("../../shared/middleware/scope.middleware");
const ClassCourseTeacherLinkModel = require("../classes/class-course-teacher-link.model");

// A learner belongs to a class, and a class has zero or more course-educator links — this is the
// only place a teacher's access to a learner is decided, so both getAllLearners and
// getLearnerById go through it.
function classTaughtByTeacher(classId, teacherId) {
  if (!classId) return false;
  return ClassCourseTeacherLinkModel.findByClassId(classId).some((l) => l.teacherId === teacherId);
}

// True whenever `learnerId` has an enrollment link at `hubId` — the membership test a
// "school"-role caller needs to prove a learner belongs to its own hub. Same pattern as
// teacher.controller.js's `isLinkedToHub`.
function isLinkedToHub(learnerId, hubId) {
  return LearnerHubLinkModel.findByLearnerId(learnerId).some((l) => l.hubId === hubId);
}

// Same membership test, but for a caller that may own more than one hub — a "school" account's
// one hub, or every hub under a "branchAdmin" account's branch.
function isLinkedToOwnHub(req, learnerId) {
  if (req.user.role === "school") return isLinkedToHub(learnerId, req.ownSchool?.id);
  if (req.user.role === "branchAdmin") return !!req.ownBranchHubIds?.some((hubId) => isLinkedToHub(learnerId, hubId));
  return false;
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
  else if (req.user.role === "branchAdmin" && linkHubId) assertOwn(isOwnHub(req, linkHubId));
  if (linkHubId) await LearnerService.enrollInHub(record.id, { hubId: linkHubId, classId: classId || "", status: "active" });
  res.status(201).json({ success: true, data: record });
});

const getAllLearners = asyncHandler(async (req, res) => {
  const { schoolId, classId, status, guardianEmail } = req.query;
  const filters = { schoolId, classId, status, guardianEmail };
  if (req.user.role === "school") {
    if (!req.ownSchool) return res.json({ success: true, data: [], count: 0 });
    filters.schoolId = req.ownSchool.id;
  } else if (req.user.role === "branchAdmin") {
    if (!req.ownBranch) return res.json({ success: true, data: [], count: 0 });
    // LearnerService resolves enrollment per-hub internally (see its getAllLearners comment) —
    // call it once per hub in the branch and merge, rather than re-deriving that link-merge logic.
    const perHub = await Promise.all(req.ownBranchHubIds.map((hubId) => LearnerService.getAllLearners({ ...filters, schoolId: hubId })));
    const records = perHub.flat();
    return res.json({ success: true, data: records, count: records.length });
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
  if (req.user.role === "school" || req.user.role === "branchAdmin") assertOwn(isLinkedToOwnHub(req, record.id));
  if (req.user.role === "teacher") assertOwn(anyEnrollmentTaughtByTeacher(record.id, req.ownTeacher?.id));
  if (req.user.role === "learner") assertOwn(record.id === req.ownLearner?.id);
  res.json({ success: true, data: record });
});

const updateLearner = asyncHandler(async (req, res) => {
  const { password, ...parsed } = updateLearnerSchema.parse(req.body);
  // .partial() still applies each field's .default() when it's absent from the request body
  // (currentRungId defaults to null) — without this filter, a PUT that only sends identity
  // fields (e.g. the learner-portal profile edit form) would silently wipe whatever placement a
  // teacher/admin had already set. Only keys the caller actually sent survive.
  const data = Object.fromEntries(Object.entries(parsed).filter(([key]) => key in req.body));
  if (req.user.role === "school" || req.user.role === "branchAdmin") {
    const existing = await LearnerService.getLearnerById(req.params.id);
    assertOwn(isLinkedToOwnHub(req, existing.id));
  }
  // "learner" (guardian-mediated login) may only ever update its own linked record — the
  // learner-portal profile edit form, never an arbitrary id.
  if (req.user.role === "learner") assertOwn(req.params.id === req.ownLearner?.id);
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
  if (req.user.role === "school" || req.user.role === "branchAdmin") {
    assertOwn(isLinkedToOwnHub(req, req.params.id));
    // A school/branchAdmin only ever gets to see its own hub(s) in the list — not the names of
    // any other hub a shared learner also happens to attend.
    hubs = hubs.filter((h) => isOwnHub(req, h.id));
  } else if (req.user.role === "teacher") {
    assertOwn(anyEnrollmentTaughtByTeacher(req.params.id, req.ownTeacher?.id));
  }
  res.json({ success: true, data: hubs, count: hubs.length });
});

const enrollLearnerHub = asyncHandler(async (req, res) => {
  const data = enrollLearnerSchema.parse(req.body);
  if (req.user.role === "school" || req.user.role === "branchAdmin") assertOwn(isOwnHub(req, data.hubId));
  const hubs = await LearnerService.enrollInHub(req.params.id, data);
  res.status(201).json({ success: true, data: hubs });
});

const updateLearnerHubLink = asyncHandler(async (req, res) => {
  const data = updateEnrollmentSchema.parse(req.body);
  if (req.user.role === "school" || req.user.role === "branchAdmin") assertOwn(isOwnHub(req, req.params.hubId));
  const hubs = await LearnerService.updateEnrollment(req.params.id, req.params.hubId, data);
  res.json({ success: true, data: hubs });
});

const unenrollLearnerHub = asyncHandler(async (req, res) => {
  if (req.user.role === "school" || req.user.role === "branchAdmin") assertOwn(isOwnHub(req, req.params.hubId));
  const hubs = await LearnerService.unenrollFromHub(req.params.id, req.params.hubId);
  res.json({ success: true, data: hubs });
});

// Learner-portal-only: fired once from the first-login diagnostic gate before it reads this
// learner's Learning-Area diagnostics, so an enrollment whose issuance was missed/incomplete
// still gets caught before the gate decides there's nothing to show.
const ensureDiagnosticsIssued = asyncHandler(async (req, res) => {
  assertOwn(req.params.id === req.ownLearner?.id);
  const { hubId } = req.body;
  if (!hubId) {
    const err = new Error("hubId is required");
    err.statusCode = 400;
    throw err;
  }
  await LearnerService.ensureDiagnosticsIssued(req.params.id, hubId);
  res.json({ success: true });
});

// Learner-portal-only: fired once the first-login diagnostic gate has nothing left
// outstanding for this hub. Deliberately its own narrow endpoint rather than reusing
// updateLearnerHubLink — that route also allows changing classId/status, which a learner must
// never be able to do to their own enrollment.
const completeHubOnboarding = asyncHandler(async (req, res) => {
  assertOwn(req.params.id === req.ownLearner?.id);
  const hub = await LearnerService.markHubOnboardingComplete(req.params.id, req.params.hubId);
  res.json({ success: true, data: hub });
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
  ensureDiagnosticsIssued,
  completeHubOnboarding,
};
