const asyncHandler = require("express-async-handler");
const CourseService = require("./course.service");
const CurriculumService = require("../curriculum/curriculum.service");
const ClassModel = require("../classes/class.model");
const ClassCourseTeacherLinkModel = require("../classes/class-course-teacher-link.model");
const LearnerHubLinkModel = require("../learners/learner-hub-link.model");
const { assertOwn } = require("../../shared/middleware/scope.middleware");
const {
  createCourseSchema,
  updateCourseSchema,
  createSessionSchema,
  updateSessionSchema,
  bulkCreateSessionsSchema,
  createModuleSchema,
  updateModuleSchema,
  linkCompetencySchema,
  linkLearningAreaSchema,
  linkInventoryItemSchema,
} = require("./course.validation");

// A course is reusable across curricula/hubs (see curriculum.service.js's model comment), so
// "can this caller see this course" can't be answered from the course record alone — it has to
// trace back through whichever curriculum the caller's own hub/class actually runs, the same way
// attendance.controller.js's assertClassAccess resolves ownership through a class. Admin is
// unrestricted; every other role here (teacher/learner/school) previously had no check at all —
// any authenticated account could fetch any course by id.
async function assertCourseAccess(req, courseId) {
  if (req.user.role === "admin") return;
  const curriculumIds = await CurriculumService.findCurriculaContainingCourse(courseId);

  if (req.user.role === "school") {
    assertOwn(!!req.ownSchool?.curriculumId && curriculumIds.includes(req.ownSchool.curriculumId));
    return;
  }
  if (req.user.role === "teacher") {
    const links = await ClassCourseTeacherLinkModel.findByTeacherId(req.ownTeacher?.id);
    const classes = await Promise.all(links.map((l) => ClassModel.findById(l.classId)));
    const classCurriculumIds = classes.map((c) => c?.curriculumId).filter(Boolean);
    assertOwn(classCurriculumIds.some((cid) => curriculumIds.includes(cid)));
    return;
  }
  if (req.user.role === "learner") {
    const links = await LearnerHubLinkModel.findByLearnerId(req.ownLearner?.id);
    const classes = await Promise.all(links.map((l) => ClassModel.findById(l.classId)));
    const classCurriculumIds = classes.map((c) => c?.curriculumId).filter(Boolean);
    assertOwn(classCurriculumIds.some((cid) => curriculumIds.includes(cid)));
    return;
  }
  assertOwn(false);
}

// updateCourseSchema is createCourseSchema.partial(), but zod still materializes a field's
// .default(...) when its key is simply absent from the request body — e.g. an update body that
// only sends { description } comes back from .parse() with code:"", status:"draft", etc.,
// silently wiping every other field (same fix as learning-hub.controller.js's pickPresent).
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

const createCourse = asyncHandler(async (req, res) => {
  const data = createCourseSchema.parse(req.body);
  const course = await CourseService.createCourse(data);
  res.status(201).json({ success: true, data: course });
});

const getAllCourses = asyncHandler(async (req, res) => {
  const courses = await CourseService.getAllCourses();
  res.json({ success: true, data: courses, count: courses.length });
});

const getCourseById = asyncHandler(async (req, res) => {
  await assertCourseAccess(req, req.params.id);
  const course = await CourseService.getCourseById(req.params.id);
  res.json({ success: true, data: course });
});

const updateCourse = asyncHandler(async (req, res) => {
  const data = pickPresent(updateCourseSchema.parse(req.body), req.body);
  const course = await CourseService.updateCourse(req.params.id, data);
  res.json({ success: true, data: course });
});

const deleteCourse = asyncHandler(async (req, res) => {
  const result = await CourseService.deleteCourse(req.params.id);
  res.json({ success: true, ...result });
});

const duplicateCourse = asyncHandler(async (req, res) => {
  const course = await CourseService.duplicateCourse(req.params.id);
  res.status(201).json({ success: true, data: course });
});

/* ── Competencies ────────────────────────────────────────────────────────── */

const getCourseCompetencies = asyncHandler(async (req, res) => {
  const data = await CourseService.getCourseCompetencies(req.params.id);
  res.json({ success: true, data });
});

const linkCompetency = asyncHandler(async (req, res) => {
  const { competencyId } = linkCompetencySchema.parse(req.body);
  const data = await CourseService.linkCompetency(req.params.id, competencyId);
  res.status(201).json({ success: true, data });
});

const unlinkCompetency = asyncHandler(async (req, res) => {
  const data = await CourseService.unlinkCompetency(req.params.id, req.params.competencyId);
  res.json({ success: true, data });
});

/* ── Learning Areas ──────────────────────────────────────────────────────── */

const getCourseLearningAreas = asyncHandler(async (req, res) => {
  const data = await CourseService.getCourseLearningAreas(req.params.id);
  res.json({ success: true, data });
});

const linkLearningArea = asyncHandler(async (req, res) => {
  const { learningAreaId } = linkLearningAreaSchema.parse(req.body);
  const data = await CourseService.linkLearningArea(req.params.id, learningAreaId);
  res.status(201).json({ success: true, data });
});

const unlinkLearningArea = asyncHandler(async (req, res) => {
  const data = await CourseService.unlinkLearningArea(req.params.id, req.params.learningAreaId);
  res.json({ success: true, data });
});

/* ── Inventory ───────────────────────────────────────────────────────────── */

const getCourseInventory = asyncHandler(async (req, res) => {
  const data = await CourseService.getCourseInventory(req.params.id);
  res.json({ success: true, data });
});

const linkInventoryItem = asyncHandler(async (req, res) => {
  const { inventoryItemId, quantity } = linkInventoryItemSchema.parse(req.body);
  const data = await CourseService.linkInventoryItem(req.params.id, inventoryItemId, quantity);
  res.status(201).json({ success: true, data });
});

const unlinkInventoryItem = asyncHandler(async (req, res) => {
  const data = await CourseService.unlinkInventoryItem(req.params.id, req.params.inventoryItemId);
  res.json({ success: true, data });
});

/* ── Curricula (read-only here — a course is added to a curriculum from the
   curriculum side, see curriculum.controller.js's getCurriculumCourses/linkCourse) ── */

const getCourseCurricula = asyncHandler(async (req, res) => {
  const data = await CourseService.getCourseCurricula(req.params.id);
  res.json({ success: true, data });
});

/* ── Score Evidence resolution ──────────────────────────────────────────────── */

const getAssessmentScoring = asyncHandler(async (req, res) => {
  const data = await CourseService.getAssessmentScoring(req.params.id, req.params.assessmentId, req.query.curriculumId);
  res.json({ success: true, data });
});

/* ── Sessions ────────────────────────────────────────────────────────────── */

const getSessions = asyncHandler(async (req, res) => {
  await assertCourseAccess(req, req.params.id);
  const data = await CourseService.getSessions(req.params.id);
  res.json({ success: true, data });
});

const createSession = asyncHandler(async (req, res) => {
  const body = createSessionSchema.parse(req.body);
  const data = await CourseService.createSession(req.params.id, body);
  res.status(201).json({ success: true, data });
});

const createSessionsBulk = asyncHandler(async (req, res) => {
  const { count, moduleId } = bulkCreateSessionsSchema.parse(req.body);
  const data = await CourseService.createSessionsBulk(req.params.id, count, moduleId);
  res.status(201).json({ success: true, data });
});

const updateSession = asyncHandler(async (req, res) => {
  const body = updateSessionSchema.parse(req.body);
  const data = await CourseService.updateSession(req.params.id, req.params.sessionId, body);
  res.json({ success: true, data });
});

const deleteSession = asyncHandler(async (req, res) => {
  await CourseService.deleteSession(req.params.id, req.params.sessionId);
  res.json({ success: true });
});

/* ── Modules ─────────────────────────────────────────────────────────────── */

const getModules = asyncHandler(async (req, res) => {
  await assertCourseAccess(req, req.params.id);
  const data = await CourseService.getModules(req.params.id);
  res.json({ success: true, data });
});

const createModule = asyncHandler(async (req, res) => {
  const body = createModuleSchema.parse(req.body);
  const data = await CourseService.createModule(req.params.id, body);
  res.status(201).json({ success: true, data });
});

const updateModule = asyncHandler(async (req, res) => {
  const body = updateModuleSchema.parse(req.body);
  const data = await CourseService.updateModule(req.params.id, req.params.moduleId, body);
  res.json({ success: true, data });
});

const deleteModule = asyncHandler(async (req, res) => {
  await CourseService.deleteModule(req.params.id, req.params.moduleId);
  res.json({ success: true });
});

module.exports = {
  createCourse,
  getAllCourses,
  getCourseById,
  updateCourse,
  deleteCourse,
  duplicateCourse,
  getCourseCompetencies,
  linkCompetency,
  unlinkCompetency,
  getCourseLearningAreas,
  linkLearningArea,
  unlinkLearningArea,
  getCourseInventory,
  linkInventoryItem,
  unlinkInventoryItem,
  getCourseCurricula,
  getAssessmentScoring,
  getSessions,
  createSession,
  createSessionsBulk,
  updateSession,
  deleteSession,
  getModules,
  createModule,
  updateModule,
  deleteModule,
};
