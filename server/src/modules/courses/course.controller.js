const asyncHandler = require("express-async-handler");
const CourseService = require("./course.service");
const {
  createCourseSchema,
  updateCourseSchema,
  createSessionSchema,
  updateSessionSchema,
  bulkCreateSessionsSchema,
} = require("./course.validation");

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
  const course = await CourseService.getCourseById(req.params.id);
  res.json({ success: true, data: course });
});

const updateCourse = asyncHandler(async (req, res) => {
  const data = updateCourseSchema.parse(req.body);
  const course = await CourseService.updateCourse(req.params.id, data);
  res.json({ success: true, data: course });
});

const deleteCourse = asyncHandler(async (req, res) => {
  const result = await CourseService.deleteCourse(req.params.id);
  res.json({ success: true, ...result });
});

/* ── Sessions ────────────────────────────────────────────────────────────── */

const getSessions = asyncHandler(async (req, res) => {
  const data = await CourseService.getSessions(req.params.id);
  res.json({ success: true, data });
});

const createSession = asyncHandler(async (req, res) => {
  const body = createSessionSchema.parse(req.body);
  const data = await CourseService.createSession(req.params.id, body);
  res.status(201).json({ success: true, data });
});

const createSessionsBulk = asyncHandler(async (req, res) => {
  const { count } = bulkCreateSessionsSchema.parse(req.body);
  const data = await CourseService.createSessionsBulk(req.params.id, count);
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

module.exports = {
  createCourse,
  getAllCourses,
  getCourseById,
  updateCourse,
  deleteCourse,
  getSessions,
  createSession,
  createSessionsBulk,
  updateSession,
  deleteSession,
};
