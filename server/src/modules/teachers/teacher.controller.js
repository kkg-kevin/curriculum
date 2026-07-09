const asyncHandler = require("express-async-handler");
const TeacherService = require("./teacher.service");
const { createTeacherSchema, updateTeacherSchema } = require("./teacher.validation");

const createTeacher = asyncHandler(async (req, res) => {
  const data = createTeacherSchema.parse(req.body);
  const teacher = await TeacherService.createTeacher(data);
  res.status(201).json({ success: true, data: teacher });
});

const getAllTeachers = asyncHandler(async (req, res) => {
  const { schoolId, status, subject, email } = req.query;
  const teachers = await TeacherService.getAllTeachers({ schoolId, status, subject, email });
  res.json({ success: true, data: teachers, count: teachers.length });
});

const getTeacherById = asyncHandler(async (req, res) => {
  const teacher = await TeacherService.getTeacherById(req.params.id);
  res.json({ success: true, data: teacher });
});

const updateTeacher = asyncHandler(async (req, res) => {
  const data = updateTeacherSchema.parse(req.body);
  const teacher = await TeacherService.updateTeacher(req.params.id, data);
  res.json({ success: true, data: teacher });
});

const deleteTeacher = asyncHandler(async (req, res) => {
  const result = await TeacherService.deleteTeacher(req.params.id);
  res.json({ success: true, ...result });
});

module.exports = { createTeacher, getAllTeachers, getTeacherById, updateTeacher, deleteTeacher };
