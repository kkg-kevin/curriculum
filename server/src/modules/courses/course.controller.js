const asyncHandler = require("express-async-handler");
const CourseService = require("./course.service");
const { createCourseSchema, updateCourseSchema } = require("./course.validation");

const createCourse = asyncHandler(async (req, res) => {
  const data = createCourseSchema.parse(req.body);
  const course = await CourseService.createCourse(data);
  res.status(201).json({ success: true, data: course });
});

const getAllCourses = asyncHandler(async (req, res) => {
  const { status } = req.query;
  const courses = await CourseService.getAllCourses({ status });
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

module.exports = { createCourse, getAllCourses, getCourseById, updateCourse, deleteCourse };
