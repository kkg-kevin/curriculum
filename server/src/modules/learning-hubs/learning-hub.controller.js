const asyncHandler = require("express-async-handler");
const LearningHubService = require("./learning-hub.service");
const CurriculumModel = require("../curriculum/curriculum.model");
const AuthService = require("../auth/auth.service");
const TeacherHubLinkModel = require("../teachers/teacher-hub-link.model");
const LearnerHubLinkModel = require("../learners/learner-hub-link.model");
const {
  createLearningHubSchema,
  updateLearningHubSchema,
  attachHubCurriculumSchema,
  updateHubCurriculumStatusSchema,
} = require("./learning-hub.validation");
const { assertOwn, isOwnHub, isOwnedByAdmin } = require("../../shared/middleware/scope.middleware");

// updateLearningHubSchema is baseLearningHubSchema.partial(), but zod still materializes a field's
// default when its key is absent from the request body. Keep only keys actually present in the raw
// body so a partial update never overwrites a field the caller didn't send.
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

// Same-tenant guard for attaching a hub to a curriculum (core at create/update time, or a
// secondary curriculum via attachHubCurriculum below) — a hub and the curriculum it runs must
// belong to the same admin, mirroring the same-tenant restriction on every other cross-entity
// link once ownerAdminId scoping is in play (see courses/assessments' link endpoints for the
// same pattern). No-op for a non-admin caller — a school/curriculumAdmin can't set this field at
// all (updateLearningHubSchema strips curriculumId for "school", and only an admin ever reaches
// attachHubCurriculum).
function assertSameTenant(req, curriculum) {
  if (req.user.role !== "admin" || !curriculum) return;
  if (curriculum.ownerAdminId !== req.ownerAdminId) {
    const err = new Error("That curriculum belongs to a different admin and can't be linked here");
    err.statusCode = 403;
    throw err;
  }
}

// Defensive, one-level-only rule: a hub cannot be its own parent, and a hub that is already a
// branch cannot itself be chosen as a parent.
async function assertValidParentHub(parentHubId, ownId) {
  if (!parentHubId) return;
  if (parentHubId === ownId) {
    const err = new Error("A hub can't be its own parent");
    err.statusCode = 400;
    throw err;
  }
  const parent = await LearningHubService.getLearningHubById(parentHubId);
  if (parent.parentHubId) {
    const err = new Error("That hub is itself a branch - a branch can't have its own branches");
    err.statusCode = 400;
    throw err;
  }
}

const createLearningHub = asyncHandler(async (req, res) => {
  const { password, ...data } = createLearningHubSchema.parse(req.body);
  await assertValidParentHub(data.parentHubId, null);
  if (data.curriculumId) {
    const curriculum = await CurriculumModel.findById(data.curriculumId);
    if (!curriculum) {
      const err = new Error("Curriculum not found");
      err.statusCode = 404;
      throw err;
    }
    assertSameTenant(req, curriculum);
  }
  if (password) {
    await AuthService.setOrCreatePassword({ name: data.name, email: data.email, password, role: "school" });
  }
  // ownerAdminId is never client-supplied — always the creating admin's own tenant id, same
  // posture as curriculum.controller.js keeping curriculumAdminId out of the general write path.
  const record = await LearningHubService.createLearningHub({ ...data, ownerAdminId: req.ownerAdminId });
  res.status(201).json({ success: true, data: record });
});

// A "school" account's own hub(s), for the school-portal hub-switcher.
const getMyLearningHubs = asyncHandler(async (req, res) => {
  const hubs = req.ownSchools || [];
  res.json({ success: true, data: hubs, count: hubs.length });
});

const getAllLearningHubs = asyncHandler(async (req, res) => {
  const { status, county, curriculumId, parentHubId, email, hubType, includeDrafts } = req.query;
  const filters = { status, county, curriculumId, parentHubId, email, hubType, includeDrafts: includeDrafts === "true" };
  if (req.user.role === "school") {
    if (!req.ownSchool) return res.json({ success: true, data: [], count: 0 });
    filters.email = req.ownSchool.email;
    filters.includeDrafts = true;
  }
  if (req.user.role === "admin") {
    filters.ownerAdminId = req.ownerAdminId;
    filters.includeDrafts = true;
  }
  const records = await LearningHubService.getAllLearningHubs(filters);
  res.json({ success: true, data: records, count: records.length });
});

const getLearningHubById = asyncHandler(async (req, res) => {
  const record = await LearningHubService.getLearningHubById(req.params.id);
  if (req.user.role === "admin") assertOwn(isOwnedByAdmin(req, record));
  if (req.user.role === "school") assertOwn(isOwnHub(req, record.id));
  if (req.user.role === "teacher") {
    const linked = req.ownTeacher
      ? (await TeacherHubLinkModel.findByTeacherId(req.ownTeacher.id)).some((l) => l.hubId === record.id)
      : false;
    assertOwn(linked);
  }
  if (req.user.role === "learner") {
    const enrolled = req.ownLearner
      ? (await LearnerHubLinkModel.findByLearnerId(req.ownLearner.id)).some((l) => l.hubId === record.id)
      : false;
    assertOwn(enrolled);
  }
  res.json({ success: true, data: record });
});

const getHubTeachers = asyncHandler(async (req, res) => {
  if (req.user.role === "school") assertOwn(isOwnHub(req, req.params.id));
  if (req.user.role === "admin") {
    assertOwn(isOwnedByAdmin(req, await LearningHubService.getLearningHubById(req.params.id)));
  }
  const teachers = await LearningHubService.getHubTeachers(req.params.id);
  res.json({ success: true, data: teachers, count: teachers.length });
});

const getHubCurricula = asyncHandler(async (req, res) => {
  if (req.user.role === "school") assertOwn(isOwnHub(req, req.params.id));
  if (req.user.role === "admin") {
    assertOwn(isOwnedByAdmin(req, await LearningHubService.getLearningHubById(req.params.id)));
  }
  const curricula = await LearningHubService.getHubCurricula(req.params.id);
  res.json({ success: true, data: curricula, count: curricula.length });
});

const updateLearningHub = asyncHandler(async (req, res) => {
  const parsed = pickPresent(updateLearningHubSchema.parse(req.body), req.body);
  const { password, ...data } = parsed;
  if (req.user.role === "school") {
    const existing = await LearningHubService.getLearningHubById(req.params.id);
    assertOwn(isOwnHub(req, existing.id));
    data.code = existing.code;
    data.status = existing.status;
    data.curriculumId = existing.curriculumId;
    data.hubType = existing.hubType;
    data.parentHubId = existing.parentHubId;
  } else {
    if (req.user.role === "admin") {
      assertOwn(isOwnedByAdmin(req, await LearningHubService.getLearningHubById(req.params.id)));
    }
    await assertValidParentHub(data.parentHubId, req.params.id);
    if (Object.prototype.hasOwnProperty.call(data, "curriculumId") && data.curriculumId) {
      const curriculum = await CurriculumModel.findById(data.curriculumId);
      if (!curriculum) {
        const err = new Error("Curriculum not found");
        err.statusCode = 404;
        throw err;
      }
      assertSameTenant(req, curriculum);
    }
  }

  const record = await LearningHubService.updateLearningHub(req.params.id, data);
  if (password) {
    if (!record.email) {
      const err = new Error("An email address is required to set a password");
      err.statusCode = 400;
      throw err;
    }
    await AuthService.setOrCreatePassword({ name: record.name, email: record.email, password, role: "school" });
  }
  res.json({ success: true, data: record });
});

const attachHubCurriculum = asyncHandler(async (req, res) => {
  const { curriculumId, role } = attachHubCurriculumSchema.parse(req.body);
  if (req.user.role === "admin") {
    assertOwn(isOwnedByAdmin(req, await LearningHubService.getLearningHubById(req.params.id)));
    assertSameTenant(req, await CurriculumModel.findById(curriculumId));
  }
  const record = await LearningHubService.attachSecondaryCurriculum(req.params.id, curriculumId, role);
  res.status(201).json({ success: true, data: record });
});

const updateHubCurriculumStatus = asyncHandler(async (req, res) => {
  const { status } = updateHubCurriculumStatusSchema.parse(req.body);
  const record = await LearningHubService.updateSecondaryCurriculumStatus(req.params.id, req.params.curriculumId, status);
  res.json({ success: true, data: record });
});

const detachHubCurriculum = asyncHandler(async (req, res) => {
  const removed = await LearningHubService.detachCurriculum(req.params.id, req.params.curriculumId);
  if (!removed) {
    const err = new Error("Hub curriculum link not found");
    err.statusCode = 404;
    throw err;
  }
  res.json({ success: true, message: "Hub curriculum detached successfully" });
});

const deleteLearningHub = asyncHandler(async (req, res) => {
  if (req.user.role === "admin") {
    assertOwn(isOwnedByAdmin(req, await LearningHubService.getLearningHubById(req.params.id)));
  }
  const result = await LearningHubService.deleteLearningHub(req.params.id);
  res.json({ success: true, ...result });
});

module.exports = {
  createLearningHub,
  getAllLearningHubs,
  getMyLearningHubs,
  getLearningHubById,
  getHubTeachers,
  getHubCurricula,
  updateLearningHub,
  attachHubCurriculum,
  updateHubCurriculumStatus,
  detachHubCurriculum,
  deleteLearningHub,
};
