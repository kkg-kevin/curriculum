const asyncHandler = require("express-async-handler");
const AttendanceService = require("./attendance.service");
const ClassModel = require("../classes/class.model");
const ClassCourseTeacherLinkModel = require("../classes/class-course-teacher-link.model");
const { markAttendanceSchema } = require("./attendance.validation");
const { assertOwn, isOwnHub } = require("../../shared/middleware/scope.middleware");

// Attendance belongs to a Class, which itself belongs to a school and (for the teacher case) is
// gated by whether that teacher has at least one course-educator link in the class — so every
// route here first loads the target Class and reuses the exact same ownership checks
// class.controller.js already applies to the class itself.
async function assertClassAccess(req, cls) {
  if (!cls) {
    const err = new Error("Class not found");
    err.statusCode = 404;
    throw err;
  }
  if (req.user.role === "school" || req.user.role === "branchAdmin") assertOwn(isOwnHub(req, cls.schoolId));
  if (req.user.role === "teacher") {
    const links = await ClassCourseTeacherLinkModel.findByClassId(cls.id);
    assertOwn(links.some((l) => l.teacherId === req.ownTeacher?.id));
  }
}

const markAttendance = asyncHandler(async (req, res) => {
  const { classId, date, records } = markAttendanceSchema.parse(req.body);
  const cls = await ClassModel.findById(classId);
  await assertClassAccess(req, cls);
  const result = await AttendanceService.markAttendance(classId, date, records, req.ownTeacher?.id || req.user.id);
  res.status(201).json({ success: true, data: result });
});

const getByClassDate = asyncHandler(async (req, res) => {
  const { classId, date } = req.query;
  if (!classId || !date) {
    const err = new Error("classId and date are required");
    err.statusCode = 400;
    throw err;
  }
  const cls = await ClassModel.findById(classId);
  await assertClassAccess(req, cls);
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
  const cls = await ClassModel.findById(classId);
  await assertClassAccess(req, cls);
  const records = await AttendanceService.getHistory({ classId, learnerId, dateFrom, dateTo, status });
  res.json({ success: true, data: records, count: records.length });
});

module.exports = { markAttendance, getByClassDate, getHistory };
