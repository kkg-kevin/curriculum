const asyncHandler = require("express-async-handler");
const LearningHubService = require("./learning-hub.service");
const AuthService = require("../auth/auth.service");
const TeacherHubLinkModel = require("../teachers/teacher-hub-link.model");
const LearnerHubLinkModel = require("../learners/learner-hub-link.model");
const { createLearningHubSchema, updateLearningHubSchema } = require("./learning-hub.validation");
const { assertOwn } = require("../../shared/middleware/scope.middleware");

// updateLearningHubSchema is baseLearningHubSchema.partial(), but zod still materializes a field's
// .default(...) when its key is simply absent from the request body — e.g. an update body that
// omits "email" comes back from .parse() with email: "", silently wiping it. Recursively keep
// only keys actually present in the raw body so a genuinely partial update never overwrites a
// field the caller didn't send.
function pickPresent(parsed, raw) {
  if (raw === null || typeof raw !== "object") return parsed;
  const result = {};
  for (const key of Object.keys(raw)) {
    if (parsed[key] === undefined) continue;
    result[key] = (typeof parsed[key] === "object" && parsed[key] !== null && !Array.isArray(parsed[key]))
      ? pickPresent(parsed[key], raw[key])
      : parsed[key];
  }
  return result;
}

const createLearningHub = asyncHandler(async (req, res) => {
  const { password, ...data } = createLearningHubSchema.parse(req.body);
  // Create the login first — if it fails (e.g. the email is already someone else's account),
  // nothing is written at all, rather than leaving an orphaned hub with no matching login.
  if (password) {
    await AuthService.setOrCreatePassword({ name: data.name, email: data.email, password, role: "school" });
  }
  const record = await LearningHubService.createLearningHub(data);
  res.status(201).json({ success: true, data: record });
});

const getAllLearningHubs = asyncHandler(async (req, res) => {
  const { status, county, curriculumId, email, hubType, includeDrafts } = req.query;
  const filters = { status, county, curriculumId, email, hubType, includeDrafts: includeDrafts === "true" };
  // A "school"-role account only ever sees its own record (the account is matched to whichever
  // hub has its email — see scope.middleware.js's attachOwnRecords). Always include drafts here:
  // a school can log in and land on its own profile before an admin has activated it.
  if (req.user.role === "school") {
    if (!req.ownSchool) return res.json({ success: true, data: [], count: 0 });
    filters.email = req.ownSchool.email;
    filters.includeDrafts = true;
  }
  const records = await LearningHubService.getAllLearningHubs(filters);
  res.json({ success: true, data: records, count: records.length });
});

const getLearningHubById = asyncHandler(async (req, res) => {
  const record = await LearningHubService.getLearningHubById(req.params.id);
  if (req.user.role === "school")  assertOwn(record.id === req.ownSchool?.id);
  if (req.user.role === "teacher") {
    const linked = req.ownTeacher
      ? TeacherHubLinkModel.findByTeacherId(req.ownTeacher.id).some((l) => l.hubId === record.id)
      : false;
    assertOwn(linked);
  }
  if (req.user.role === "learner") {
    const enrolled = req.ownLearner
      ? LearnerHubLinkModel.findByLearnerId(req.ownLearner.id).some((l) => l.hubId === record.id)
      : false;
    assertOwn(enrolled);
  }
  res.json({ success: true, data: record });
});

// Read-only mirror of the teacher-hub link table, scoped to one hub — the write side lives on
// the teacher routes (see teacher.routes.js's /:id/hubs/links), this just lets a hub see who's
// assigned to it.
const getHubTeachers = asyncHandler(async (req, res) => {
  if (req.user.role === "school") assertOwn(req.params.id === req.ownSchool?.id);
  const teachers = await LearningHubService.getHubTeachers(req.params.id);
  res.json({ success: true, data: teachers, count: teachers.length });
});

const updateLearningHub = asyncHandler(async (req, res) => {
  const parsed = pickPresent(updateLearningHubSchema.parse(req.body), req.body);
  const { password, ...data } = parsed;
  if (req.user.role === "school") {
    const existing = await LearningHubService.getLearningHubById(req.params.id);
    assertOwn(existing.id === req.ownSchool?.id);
    // A school can update its own contact info, but code/status/curriculum assignment/type stay
    // platform-admin-controlled governance fields — force them back to their current values
    // regardless of what's in the request body.
    data.code = existing.code;
    data.status = existing.status;
    data.curriculumId = existing.curriculumId;
    data.hubType = existing.hubType;
  }
  const record = await LearningHubService.updateLearningHub(req.params.id, data);
  if (password) {
    if (record.hubType !== "school" || !record.email) {
      const err = new Error("A password can only be set for a school-type learning hub with an email address");
      err.statusCode = 400;
      throw err;
    }
    await AuthService.setOrCreatePassword({ name: record.name, email: record.email, password, role: "school" });
  }
  res.json({ success: true, data: record });
});

const deleteLearningHub = asyncHandler(async (req, res) => {
  const result = await LearningHubService.deleteLearningHub(req.params.id);
  res.json({ success: true, ...result });
});

module.exports = { createLearningHub, getAllLearningHubs, getLearningHubById, updateLearningHub, deleteLearningHub, getHubTeachers };
