const asyncHandler = require("express-async-handler");
const CurriculumService = require("./curriculum.service");
const AuthService = require("../auth/auth.service");
const LearningHubService = require("../learning-hubs/learning-hub.service");
const { createCurriculumSchema, updateCurriculumSchema, linkCourseSchema, assignAdminSchema } = require("./curriculum.validation");
const { assertOwn } = require("../../shared/middleware/scope.middleware");
const SchoolModel = require("../learning-hubs/learning-hub.model");
const TeacherHubLinkModel = require("../teachers/teacher-hub-link.model");
const ProgramModel = require("../programs/program.model");

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
  const curriculum = await CurriculumService.createCurriculum(data);
  res.status(201).json({ success: true, data: curriculum });
});

const getAllCurricula = asyncHandler(async (req, res) => {
  const { framework, academicYear } = req.query;
  const curricula = await CurriculumService.getAllCurricula({ framework, academicYear });
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

  if (req.user.role === "school") {
    const accessible = new Set(req.ownSchoolCurriculumIds || (req.ownSchool?.curriculumId ? [req.ownSchool.curriculumId] : []));
    const isOwnCurriculum = accessible.has(curriculum.id);
    const deployedPrograms = await ProgramModel.findAll({ curriculumId: curriculum.id });
    const isDeployedProgram = deployedPrograms.some((p) => p.hubId === req.ownSchool?.id);
    assertOwn(isOwnCurriculum || isDeployedProgram);
  } else if (req.user.role === "teacher") {
    const hubIds = req.ownTeacher ? (await TeacherHubLinkModel.findByTeacherId(req.ownTeacher.id)).map((l) => l.hubId) : [];
    const hubs = await Promise.all(hubIds.map((hid) => SchoolModel.findById(hid)));
    const accessible = new Set(await getTeacherAccessibleCurriculumIds(req));
    const isOwnCurriculum = accessible.has(curriculum.id) || hubs.some((hub) => hub?.curriculumId === curriculum.id);
    const deployedPrograms = await ProgramModel.findAll({ curriculumId: curriculum.id });
    const isDeployedProgram = deployedPrograms.some((p) => hubIds.includes(p.hubId));
    assertOwn(isOwnCurriculum || isDeployedProgram);
  } else if (req.user.role === "curriculumAdmin") {
    assertOwn(req.ownCurriculum?.id === curriculum.id);
  }

  res.json({ success: true, data: curriculum });
});

const updateCurriculum = asyncHandler(async (req, res) => {
  const data = updateCurriculumSchema.parse(req.body);
  const curriculum = await CurriculumService.updateCurriculum(req.params.id, data);
  res.json({ success: true, data: curriculum });
});

const deleteCurriculum = asyncHandler(async (req, res) => {
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
