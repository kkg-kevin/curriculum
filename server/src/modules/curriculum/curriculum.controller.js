const asyncHandler = require("express-async-handler");
const CurriculumService = require("./curriculum.service");
const AuthService = require("../auth/auth.service");
const LearningHubService = require("../learning-hubs/learning-hub.service");
const { createCurriculumSchema, updateCurriculumSchema, linkCourseSchema, assignAdminSchema } = require("./curriculum.validation");
const { assertOwn, isOwnedByAdmin } = require("../../shared/middleware/scope.middleware");
const SchoolModel = require("../learning-hubs/learning-hub.model");
const TeacherHubLinkModel = require("../teachers/teacher-hub-link.model");
const EventModel = require("../events/event.model");
const CourseModel = require("../courses/course.model");

async function getTeacherAccessibleCurriculumIds(req) {
  if (!req.ownTeacher) return [];
  const links = await TeacherHubLinkModel.findByTeacherId(req.ownTeacher.id);
  const ids = new Set();
  for (const link of links) {
    const curriculumIds = await LearningHubService.getEffectiveCurriculumIds(link.hubId);
    curriculumIds.forEach((id) => ids.add(id));
  }
  return [...ids];
}

const createCurriculum = asyncHandler(async (req, res) => {
  const data = createCurriculumSchema.parse(req.body);
  // ownerAdminId is never client-supplied — always the creating admin's own tenant id, same
  // posture as curriculumAdminId being set only through the dedicated assign endpoint below.
  const curriculum = await CurriculumService.createCurriculum({ ...data, ownerAdminId: req.ownerAdminId });
  res.status(201).json({ success: true, data: curriculum });
});

const getAllCurricula = asyncHandler(async (req, res) => {
  const { framework, academicYear } = req.query;
  const filters = { framework, academicYear };
  if (req.user.role === "admin") filters.ownerAdminId = req.ownerAdminId;
  const curricula = await CurriculumService.getAllCurricula(filters);
  res.json({ success: true, data: curricula, count: curricula.length });
});

const getMyCurriculum = asyncHandler(async (req, res) => {
  if (!req.ownCurriculum) {
    const err = new Error("No curriculum is assigned to this account yet");
    err.statusCode = 404;
    throw err;
  }
  const curriculum = await CurriculumService.getCurriculumById(req.ownCurriculum.id);
  res.json({ success: true, data: curriculum });
});

const getCurriculumById = asyncHandler(async (req, res) => {
  const curriculum = await CurriculumService.getCurriculumById(req.params.id);

  if (req.user.role === "admin") {
    assertOwn(isOwnedByAdmin(req, curriculum));
  } else if (req.user.role === "school") {
    const accessible = new Set(req.ownSchoolCurriculumIds || (req.ownSchool?.curriculumId ? [req.ownSchool.curriculumId] : []));
    const isOwnCurriculum = accessible.has(curriculum.id);
    const deployedEvents = await EventModel.findAll({ curriculumId: curriculum.id });
    const isDeployedEvent = deployedEvents.some((e) => e.hubId === req.ownSchool?.id);
    assertOwn(isOwnCurriculum || isDeployedEvent);
  } else if (req.user.role === "teacher") {
    const hubIds = req.ownTeacher ? (await TeacherHubLinkModel.findByTeacherId(req.ownTeacher.id)).map((l) => l.hubId) : [];
    const hubs = await Promise.all(hubIds.map((hid) => SchoolModel.findById(hid)));
    const accessible = new Set(await getTeacherAccessibleCurriculumIds(req));
    const isOwnCurriculum = accessible.has(curriculum.id) || hubs.some((hub) => hub?.curriculumId === curriculum.id);
    const deployedEvents = await EventModel.findAll({ curriculumId: curriculum.id });
    const isDeployedEvent = deployedEvents.some((e) => hubIds.includes(e.hubId));
    assertOwn(isOwnCurriculum || isDeployedEvent);
  } else if (req.user.role === "curriculumAdmin") {
    assertOwn(req.ownCurriculum?.id === curriculum.id);
  }

  res.json({ success: true, data: curriculum });
});

const updateCurriculum = asyncHandler(async (req, res) => {
  const data = updateCurriculumSchema.parse(req.body);
  if (req.user.role === "admin") {
    assertOwn(isOwnedByAdmin(req, await CurriculumService.getCurriculumById(req.params.id)));
  }
  const curriculum = await CurriculumService.updateCurriculum(req.params.id, data);
  res.json({ success: true, data: curriculum });
});

const deleteCurriculum = asyncHandler(async (req, res) => {
  if (req.user.role === "admin") {
    assertOwn(isOwnedByAdmin(req, await CurriculumService.getCurriculumById(req.params.id)));
  }
  const result = await CurriculumService.deleteCurriculum(req.params.id);
  res.json({ success: true, ...result });
});

const assignCurriculumAdmin = asyncHandler(async (req, res) => {
  const { name, email, password } = assignAdminSchema.parse(req.body);
  const user = await AuthService.setOrCreatePassword({ name, email, password, role: "curriculumAdmin" });
  const curriculum = await CurriculumService.setCurriculumAdmin(req.params.id, user.id);
  res.json({ success: true, data: curriculum });
});

const unassignCurriculumAdmin = asyncHandler(async (req, res) => {
  const curriculum = await CurriculumService.setCurriculumAdmin(req.params.id, null);
  res.json({ success: true, data: curriculum });
});

const getCurriculumCourses = asyncHandler(async (req, res) => {
  const data = await CurriculumService.getCurriculumCourses(req.params.id);
  res.json({ success: true, data });
});

const linkCourse = asyncHandler(async (req, res) => {
  const { courseId } = linkCourseSchema.parse(req.body);
  // The curriculum side is already confirmed same-tenant by ownCurriculumOnly (curriculum.routes.js's
  // router-level gate this route sits behind) — this only additionally confirms the COURSE being
  // linked belongs to the same admin, mirroring learning-hub.controller.js's assertSameTenant for
  // the hub<->curriculum link. No-op for curriculumAdmin (can't cross tenants at all — every
  // curriculum they touch is already scoped to the one they manage).
  if (req.user.role === "admin") {
    const course = await CourseModel.findById(courseId);
    if (course && course.ownerAdminId !== req.ownerAdminId) {
      const err = new Error("That course belongs to a different admin and can't be linked here");
      err.statusCode = 403;
      throw err;
    }
  }
  const data = await CurriculumService.linkCourse(req.params.id, courseId);
  res.status(201).json({ success: true, data });
});

const unlinkCourse = asyncHandler(async (req, res) => {
  const data = await CurriculumService.unlinkCourse(req.params.id, req.params.courseId);
  res.json({ success: true, data });
});

module.exports = {
  createCurriculum,
  getAllCurricula,
  getMyCurriculum,
  getCurriculumById,
  updateCurriculum,
  deleteCurriculum,
  getCurriculumCourses,
  linkCourse,
  unlinkCourse,
  assignCurriculumAdmin,
  unassignCurriculumAdmin,
};
