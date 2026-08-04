const asyncHandler = require("express-async-handler");
const TimetableService = require("./timetable.service");
const TimetableModel = require("./timetable.model");
const ClassModel = require("../classes/class.model");
const ClassCourseTeacherLinkModel = require("../classes/class-course-teacher-link.model");
const { createSlotSchema, updateSlotSchema, setCourseScheduleSchema, calendarRangeSchema } = require("./timetable.validation");
const { assertOwn, isOwnHub } = require("../../shared/middleware/scope.middleware");

// Same shape as attendance.controller.js's assertClassAccess — a timetable slot belongs to a
// Class, so ownership is resolved through that class exactly the same way attendance already
// does it. Teachers only ever reach this read-only (see routes), so no write-side teacher check
// is needed here beyond what's already enforced by role authorization.
function assertClassAccess(req, cls) {
  if (!cls) {
    const err = new Error("Class not found");
    err.statusCode = 404;
    throw err;
  }
  if (req.user.role === "school" || req.user.role === "branchAdmin") assertOwn(isOwnHub(req, cls.schoolId));
  if (req.user.role === "teacher") {
    assertOwn(ClassCourseTeacherLinkModel.findByClassId(cls.id).some((l) => l.teacherId === req.ownTeacher?.id));
  }
}

function loadOwnedSlotOrThrow(req) {
  const slot = TimetableModel.findById(req.params.id);
  if (!slot) {
    const err = new Error("Timetable slot not found");
    err.statusCode = 404;
    throw err;
  }
  assertClassAccess(req, ClassModel.findById(slot.classId));
  return slot;
}

const createSlot = asyncHandler(async (req, res) => {
  const data = createSlotSchema.parse(req.body);
  const cls = ClassModel.findById(data.classId);
  assertClassAccess(req, cls);
  const slot = TimetableService.createSlot(data);
  res.status(201).json({ success: true, data: slot });
});

const listByClass = asyncHandler(async (req, res) => {
  const { classId } = req.query;
  if (!classId) {
    const err = new Error("classId is required");
    err.statusCode = 400;
    throw err;
  }
  const cls = ClassModel.findById(classId);
  assertClassAccess(req, cls);
  const slots = TimetableService.listForClass(classId);
  res.json({ success: true, data: slots, count: slots.length });
});

const updateSlot = asyncHandler(async (req, res) => {
  loadOwnedSlotOrThrow(req);
  const parsed = updateSlotSchema.parse(req.body);
  // Same "only keys present in the raw body survive" guard every partial-update endpoint in
  // this codebase needs, added here from the start rather than found later as a live bug.
  const data = Object.fromEntries(Object.entries(parsed).filter(([key]) => key in req.body));
  const slot = TimetableService.updateSlot(req.params.id, data);
  res.json({ success: true, data: slot });
});

const deleteSlot = asyncHandler(async (req, res) => {
  loadOwnedSlotOrThrow(req);
  const result = TimetableService.deleteSlot(req.params.id);
  res.json({ success: true, ...result });
});

const getMyTeacherTimetable = asyncHandler(async (req, res) => {
  if (!req.ownTeacher) return res.json({ success: true, data: [] });
  const slots = TimetableService.listForTeacher(req.ownTeacher.id);
  res.json({ success: true, data: slots, count: slots.length });
});

const getMyLearnerTimetable = asyncHandler(async (req, res) => {
  if (!req.ownLearner) return res.json({ success: true, data: [] });
  const slots = TimetableService.listForLearner(req.ownLearner.id);
  res.json({ success: true, data: slots, count: slots.length });
});

const listCourseSchedules = asyncHandler(async (req, res) => {
  const { classId } = req.query;
  if (!classId) {
    const err = new Error("classId is required");
    err.statusCode = 400;
    throw err;
  }
  const cls = ClassModel.findById(classId);
  assertClassAccess(req, cls);
  const schedules = TimetableService.listCourseSchedules(classId);
  res.json({ success: true, data: schedules });
});

const setCourseSchedule = asyncHandler(async (req, res) => {
  const { classId, courseId, startDate } = setCourseScheduleSchema.parse(req.body);
  const cls = ClassModel.findById(classId);
  assertClassAccess(req, cls);
  const schedule = TimetableService.setCourseSchedule(classId, courseId, startDate);
  res.json({ success: true, data: schedule });
});

const getClassCalendar = asyncHandler(async (req, res) => {
  const { classId } = req.query;
  if (!classId) {
    const err = new Error("classId is required");
    err.statusCode = 400;
    throw err;
  }
  const cls = ClassModel.findById(classId);
  assertClassAccess(req, cls);
  const { from, to } = calendarRangeSchema.parse(req.query);
  const { events, breaks } = TimetableService.resolveCalendar({ classId, from, to });
  res.json({ success: true, data: events, breaks, count: events.length });
});

const getMyTeacherCalendar = asyncHandler(async (req, res) => {
  if (!req.ownTeacher) return res.json({ success: true, data: [], breaks: [] });
  const { from, to } = calendarRangeSchema.parse(req.query);
  const { events, breaks } = TimetableService.resolveTeacherCalendar(req.ownTeacher.id, from, to);
  res.json({ success: true, data: events, breaks, count: events.length });
});

const getMyLearnerCalendar = asyncHandler(async (req, res) => {
  if (!req.ownLearner) return res.json({ success: true, data: [], breaks: [] });
  const { from, to } = calendarRangeSchema.parse(req.query);
  const { events, breaks } = TimetableService.resolveLearnerCalendar(req.ownLearner.id, from, to);
  res.json({ success: true, data: events, breaks, count: events.length });
});

module.exports = {
  createSlot, listByClass, updateSlot, deleteSlot,
  getMyTeacherTimetable, getMyLearnerTimetable,
  listCourseSchedules, setCourseSchedule,
  getClassCalendar, getMyTeacherCalendar, getMyLearnerCalendar,
};
