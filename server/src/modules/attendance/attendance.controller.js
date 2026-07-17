const asyncHandler = require("express-async-handler");
const AttendanceService = require("./attendance.service");
const ClassModel = require("../classes/class.model");
const { markAttendanceSchema } = require("./attendance.validation");
const { assertOwn } = require("../../shared/middleware/scope.middleware");

// Attendance belongs to a Class, which itself belongs to a school and (for the class-teacher
// case) a teacher — so every route here first loads the target Class and reuses the exact same
// ownership checks class.controller.js already applies to the class itself.
function assertClassAccess(req, cls) {
  if (!cls) {
    const err = new Error("Class not found");
    err.statusCode = 404;
    throw err;
  }
  if (req.user.role === "school")  assertOwn(cls.schoolId === req.ownSchool?.id);
  if (req.user.role === "teacher") assertOwn(cls.classTeacherId === req.ownTeacher?.id);
}

const markAttendance = asyncHandler(async (req, res) => {
  const { classId, date, records } = markAttendanceSchema.parse(req.body);
  const cls = ClassModel.findById(classId);
  assertClassAccess(req, cls);
  const result = await AttendanceService.markAttendance(classId, date, records, req.user.id);
  res.status(201).json({ success: true, data: result });
});

const getByClassDate = asyncHandler(async (req, res) => {
  const { classId, date } = req.query;
  if (!classId || !date) {
    const err = new Error("classId and date are required");
    err.statusCode = 400;
    throw err;
  }
  const cls = ClassModel.findById(classId);
  assertClassAccess(req, cls);
  const records = await AttendanceService.getByClassAndDate(classId, date);
  res.json({ success: true, data: records, count: records.length });
});

const getHistory = asyncHandler(async (req, res) => {
  const { classId, learnerId, dateFrom, dateTo, status } = req.query;
  if (!classId) {
    const err = new Error("classId is required");
    err.statusCode = 400;
    throw err;
  }
  const cls = ClassModel.findById(classId);
  assertClassAccess(req, cls);
  const records = await AttendanceService.getHistory({ classId, learnerId, dateFrom, dateTo, status });
  res.json({ success: true, data: records, count: records.length });
});

module.exports = { markAttendance, getByClassDate, getHistory };
