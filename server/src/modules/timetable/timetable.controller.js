const asyncHandler = require("express-async-handler");
const TimetableService = require("./timetable.service");
const TimetableModel = require("./timetable.model");
const SessionSkipModel = require("./session-skip.model");
const SessionOccurrenceModel = require("./session-occurrence.model");
const SessionOccurrenceService = require("./session-occurrence.service");
const ClassModel = require("../classes/class.model");
const ClassCourseTeacherLinkModel = require("../classes/class-course-teacher-link.model");
const { createSlotSchema, updateSlotSchema, setCourseScheduleSchema, calendarRangeSchema, sessionStatusBulkSchema, createSkipSchema, occurrenceActionSchema } = require("./timetable.validation");
const { assertOwn, isOwnHub } = require("../../shared/middleware/scope.middleware");

// Same shape as attendance.controller.js's assertClassAccess — a timetable slot belongs to a
// Class, so ownership is resolved through that class exactly the same way attendance already
// does it. Teachers only ever reach this read-only (see routes), so no write-side teacher check
// is needed here beyond what's already enforced by role authorization.
async function assertClassAccess(req, cls) {
  if (!cls) {
    const err = new Error("Class not found");
    err.statusCode = 404;
    throw err;
  }
  if (req.user.role === "school") assertOwn(isOwnHub(req, cls.schoolId));
  if (req.user.role === "teacher") {
    const links = await ClassCourseTeacherLinkModel.findByClassId(cls.id);
    assertOwn(links.some((l) => l.teacherId === req.ownTeacher?.id));
  }
}

async function loadOwnedSlotOrThrow(req) {
  const slot = await TimetableModel.findById(req.params.id);
  if (!slot) {
    const err = new Error("Timetable slot not found");
    err.statusCode = 404;
    throw err;
  }
  await assertClassAccess(req, await ClassModel.findById(slot.classId));
  return slot;
}

const createSlot = asyncHandler(async (req, res) => {
  const data = createSlotSchema.parse(req.body);
  const cls = await ClassModel.findById(data.classId);
  await assertClassAccess(req, cls);
  const slot = await TimetableService.createSlot(data);
  res.status(201).json({ success: true, data: slot });
});

const listByClass = asyncHandler(async (req, res) => {
  const { classId } = req.query;
  if (!classId) {
    const err = new Error("classId is required");
    err.statusCode = 400;
    throw err;
  }
  const cls = await ClassModel.findById(classId);
  await assertClassAccess(req, cls);
  const slots = await TimetableService.listForClass(classId);
  res.json({ success: true, data: slots, count: slots.length });
});

const updateSlot = asyncHandler(async (req, res) => {
  await loadOwnedSlotOrThrow(req);
  const parsed = updateSlotSchema.parse(req.body);
  // Same "only keys present in the raw body survive" guard every partial-update endpoint in
  // this codebase needs, added here from the start rather than found later as a live bug.
  const data = Object.fromEntries(Object.entries(parsed).filter(([key]) => key in req.body));
  const slot = await TimetableService.updateSlot(req.params.id, data);
  res.json({ success: true, data: slot });
});

const deleteSlot = asyncHandler(async (req, res) => {
  await loadOwnedSlotOrThrow(req);
  const result = await TimetableService.deleteSlot(req.params.id);
  res.json({ success: true, ...result });
});

// Which of a course's candidate teachers (the ids already populating the school-portal's
// teacher <select>) would conflict if picked for this day/time — either double-booked or
// outside their own declared availability. Same ownership posture as every other class-scoped
// read here. teacherIds comes from the client (the same class-course-teacher links already
// populating the picker), not resolved server-side, since "candidate" here means "appears in
// this picker", not "every teacher in the system".
const getTeacherAvailabilityConflicts = asyncHandler(async (req, res) => {
  const { classId, courseId, dayOfWeek, startTime, endTime, excludeSlotId } = req.query;
  if (!classId) {
    const err = new Error("classId is required");
    err.statusCode = 400;
    throw err;
  }
  const cls = await ClassModel.findById(classId);
  await assertClassAccess(req, cls);
  const teacherIds = Array.isArray(req.query.teacherIds) ? req.query.teacherIds : req.query.teacherIds ? [req.query.teacherIds] : [];
  const conflicting = await TimetableService.getConflictingTeacherIds(teacherIds, { classId, courseId, dayOfWeek, startTime, endTime, excludeSlotId });
  res.json({ success: true, data: conflicting });
});

const getMyTeacherTimetable = asyncHandler(async (req, res) => {
  if (!req.ownTeacher) return res.json({ success: true, data: [] });
  const slots = await TimetableService.listForTeacher(req.ownTeacher.id);
  res.json({ success: true, data: slots, count: slots.length });
});

const getMyLearnerTimetable = asyncHandler(async (req, res) => {
  if (!req.ownLearner) return res.json({ success: true, data: [] });
  const slots = await TimetableService.listForLearner(req.ownLearner.id);
  res.json({ success: true, data: slots, count: slots.length });
});

const listCourseSchedules = asyncHandler(async (req, res) => {
  const { classId } = req.query;
  if (!classId) {
    const err = new Error("classId is required");
    err.statusCode = 400;
    throw err;
  }
  const cls = await ClassModel.findById(classId);
  await assertClassAccess(req, cls);
  const schedules = await TimetableService.listCourseSchedules(classId);
  res.json({ success: true, data: schedules });
});

const setCourseSchedule = asyncHandler(async (req, res) => {
  const { classId, courseId, startDate } = setCourseScheduleSchema.parse(req.body);
  const cls = await ClassModel.findById(classId);
  await assertClassAccess(req, cls);
  const schedule = await TimetableService.setCourseSchedule(classId, courseId, startDate);
  res.json({ success: true, data: schedule });
});

const getClassCalendar = asyncHandler(async (req, res) => {
  const { classId } = req.query;
  if (!classId) {
    const err = new Error("classId is required");
    err.statusCode = 400;
    throw err;
  }
  const cls = await ClassModel.findById(classId);
  await assertClassAccess(req, cls);
  const { from, to } = calendarRangeSchema.parse(req.query);
  const { events, breaks, skippedSessions } = await TimetableService.resolveCalendar({ classId, from, to });
  res.json({ success: true, data: events, breaks, skippedSessions, count: events.length });
});

const getMyTeacherCalendar = asyncHandler(async (req, res) => {
  if (!req.ownTeacher) return res.json({ success: true, data: [], breaks: [], skippedSessions: [] });
  const { from, to } = calendarRangeSchema.parse(req.query);
  const { events, breaks, skippedSessions } = await TimetableService.resolveTeacherCalendar(req.ownTeacher.id, from, to);
  res.json({ success: true, data: events, breaks, skippedSessions, count: events.length });
});

const getMyLearnerCalendar = asyncHandler(async (req, res) => {
  if (!req.ownLearner) return res.json({ success: true, data: [], breaks: [], skippedSessions: [] });
  const { from, to } = calendarRangeSchema.parse(req.query);
  const { events, breaks, skippedSessions } = await TimetableService.resolveLearnerCalendar(req.ownLearner.id, from, to);
  res.json({ success: true, data: events, breaks, skippedSessions, count: events.length });
});

// Hub-wide merged calendar — every class at one Learning Hub, for the school-portal's "All
// Classes" view (same merge pattern as getMyTeacherCalendar/getMyLearnerCalendar, scoped by hub
// instead of by person). hubId comes from the query string since, unlike a class, there's no
// single owned record to resolve it from implicitly — ownership is checked the same way
// assertClassAccess checks a class's own schoolId above.
const getHubCalendar = asyncHandler(async (req, res) => {
  const { hubId } = req.query;
  if (!hubId) {
    const err = new Error("hubId is required");
    err.statusCode = 400;
    throw err;
  }
  if (req.user.role === "school") assertOwn(isOwnHub(req, hubId));
  const { from, to } = calendarRangeSchema.parse(req.query);
  const { events, breaks, skippedSessions } = await TimetableService.resolveHubCalendar(hubId, from, to);
  res.json({ success: true, data: events, breaks, skippedSessions, count: events.length });
});

// The click/hover-through detail behind one calendar event — same class-ownership posture as
// every other read here (teacher must actually teach that class, school must own its
// hub). classId and date come from the calendar event the client already has in hand (see
// resolveCalendar), not re-derived server-side.
const getSessionSummary = asyncHandler(async (req, res) => {
  const { classId, date } = req.query;
  if (!classId || !date) {
    const err = new Error("classId and date are required");
    err.statusCode = 400;
    throw err;
  }
  const cls = await ClassModel.findById(classId);
  await assertClassAccess(req, cls);
  const summary = await TimetableService.getSessionSummary({ classId, sessionId: req.params.sessionId, date });
  res.json({ success: true, data: summary });
});

// Batched sibling of getSessionSummary for the calendar's at-a-glance badges. Occurrences can
// span more than one class at once (a teacher's merged calendar), so ownership is checked per
// unique classId in the batch — any occurrence whose class the caller doesn't own is silently
// dropped from the response rather than failing the whole request over one bad triple. In
// practice the client only ever sends occurrences from events it already legitimately fetched
// from an ownership-scoped calendar endpoint, so this is defense in depth, not the expected path.
const getSessionStatusBulk = asyncHandler(async (req, res) => {
  const { occurrences } = sessionStatusBulkSchema.parse(req.body);
  const classIds = [...new Set(occurrences.map((o) => o.classId))];
  const accessFlags = await Promise.all(classIds.map(async (id) => {
    try {
      await assertClassAccess(req, await ClassModel.findById(id));
      return true;
    } catch {
      return false;
    }
  }));
  const accessibleClassIds = new Set(classIds.filter((id, i) => accessFlags[i]));
  const allowed = occurrences.filter((o) => accessibleClassIds.has(o.classId));
  const statuses = await TimetableService.getSessionStatusBulk(allowed);
  res.json({ success: true, data: statuses });
});

// A teacher's "we didn't hold this one" record — see TimetableService.createSkip. Same
// ownership posture as every other write here: teacher must actually teach the class, school/
// hub, admin unrestricted.
const createSkip = asyncHandler(async (req, res) => {
  const data = createSkipSchema.parse(req.body);
  const cls = await ClassModel.findById(data.classId);
  await assertClassAccess(req, cls);
  const skip = await TimetableService.createSkip({ ...data, createdBy: req.ownTeacher?.id || req.user.id });
  res.status(201).json({ success: true, data: skip });
});

const deleteSkip = asyncHandler(async (req, res) => {
  const skip = await SessionSkipModel.findById(req.params.id);
  if (!skip) {
    const err = new Error("Reschedule record not found");
    err.statusCode = 404;
    throw err;
  }
  await assertClassAccess(req, await ClassModel.findById(skip.classId));
  const result = await TimetableService.deleteSkip(req.params.id);
  res.json({ success: true, ...result });
});

const listSkips = asyncHandler(async (req, res) => {
  const { classId } = req.query;
  if (!classId) {
    const err = new Error("classId is required");
    err.statusCode = 400;
    throw err;
  }
  const cls = await ClassModel.findById(classId);
  await assertClassAccess(req, cls);
  const skips = await TimetableService.listSkips(classId);
  res.json({ success: true, data: skips });
});

// --- Session occurrences (durable per-session "did it run / was attendance dealt with") -------

// Loads the occurrence named by :id, then checks the caller owns its class exactly the way every
// other class-scoped write here does (teacher must actually teach the class, school must own the
// hub, admin unrestricted).
async function loadOwnedOccurrenceOrThrow(req) {
  const occ = await SessionOccurrenceModel.findById(req.params.id);
  if (!occ) {
    const err = new Error("Session occurrence not found");
    err.statusCode = 404;
    throw err;
  }
  await assertClassAccess(req, await ClassModel.findById(occ.classId));
  return occ;
}

// The hydrated occurrence list for a class — every past session with its taught/attendance
// close-out state, for the class-detail "sessions" tab. Same read posture as listByClass.
const listOccurrences = asyncHandler(async (req, res) => {
  const { classId } = req.query;
  if (!classId) {
    const err = new Error("classId is required");
    err.statusCode = 400;
    throw err;
  }
  const cls = await ClassModel.findById(classId);
  await assertClassAccess(req, cls);
  const data = await SessionOccurrenceService.listForClassHydrated(classId, (args) => TimetableService.resolveCalendar(args));
  res.json({ success: true, data });
});

// The close-out actions. `action` in the body picks which transition; a plain note is optional.
// The actor recorded is the teacher's own id when a teacher is acting, otherwise the user id.
const runOccurrenceAction = asyncHandler(async (req, res) => {
  const occ = await loadOwnedOccurrenceOrThrow(req);
  const { action, note } = occurrenceActionSchema.parse(req.body);
  const actorId = req.ownTeacher?.id || req.user.id;

  // unlock is the admin-only escape hatch (a wrongly-locked attendance) — everyone else who can
  // write to this class can run the ordinary close-outs.
  if (action === "unlock-attendance" && req.user.role !== "admin" && req.user.role !== "school") {
    const err = new Error("Only an admin or school can reopen a locked attendance");
    err.statusCode = 403;
    throw err;
  }

  const map = {
    "mark-taught": () => SessionOccurrenceService.markTaught(occ.id, { actorId, note }),
    "cancel": () => SessionOccurrenceService.cancel(occ.id, { actorId, note }),
    "reopen": () => SessionOccurrenceService.reopen(occ.id, { actorId }),
    "lock-attendance": () => SessionOccurrenceService.lockAttendanceUnmarked(occ.id, { actorId, note }),
    "unlock-attendance": () => SessionOccurrenceService.unlockAttendance(occ.id),
  };
  const data = await map[action]();
  res.json({ success: true, data });
});

module.exports = {
  createSlot, listByClass, updateSlot, deleteSlot,
  getMyTeacherTimetable, getMyLearnerTimetable,
  listCourseSchedules, setCourseSchedule,
  getClassCalendar, getMyTeacherCalendar, getMyLearnerCalendar, getHubCalendar,
  getSessionSummary, getSessionStatusBulk,
  createSkip, deleteSkip, listSkips,
  getTeacherAvailabilityConflicts,
  listOccurrences, runOccurrenceAction,
};
