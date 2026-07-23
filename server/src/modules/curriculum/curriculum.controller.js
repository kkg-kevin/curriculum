const asyncHandler = require("express-async-handler");
const CurriculumService = require("./curriculum.service");
const { createCurriculumSchema, updateCurriculumSchema, linkCourseSchema } = require("./curriculum.validation");
const { assertOwn } = require("../../shared/middleware/scope.middleware");
const SchoolModel = require("../learning-hubs/learning-hub.model");
const TeacherHubLinkModel = require("../teachers/teacher-hub-link.model");

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

const getCurriculumById = asyncHandler(async (req, res) => {
  const curriculum = await CurriculumService.getCurriculumById(req.params.id);
  // A school/teacher only ever reads the curriculum their own school is assigned — never
  // another school's curriculum, even by guessing an id.
  if (req.user.role === "school") {
    assertOwn(req.ownSchool?.curriculumId === curriculum.id);
  } else if (req.user.role === "teacher") {
    const hubIds = req.ownTeacher ? TeacherHubLinkModel.findByTeacherId(req.ownTeacher.id).map((l) => l.hubId) : [];
    const hasThisCurriculum = hubIds.some((hid) => SchoolModel.findById(hid)?.curriculumId === curriculum.id);
    assertOwn(hasThisCurriculum);
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

/* ── Courses (added to this curriculum from here) ─────────────────────────── */

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
  getCurriculumById,
  updateCurriculum,
  deleteCurriculum,
  getCurriculumCourses,
  linkCourse,
  unlinkCourse,
};
