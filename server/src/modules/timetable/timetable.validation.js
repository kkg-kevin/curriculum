const { z } = require("zod");

const DAYS_OF_WEEK = ["monday", "tuesday", "wednesday", "thursday", "friday"];

// A recurring weekly slot — "Math, Monday 9:00-10:00, every week" — not a specific calendar
// date. teacherId is an optional override: when omitted, the class's primary educator for this
// course (see class-course-teacher-link.model.js) is who the schedule implies, without this
// record having to duplicate that assignment.
const baseSlotSchema = z.object({
  classId:   z.string().min(1, "Class is required"),
  courseId:  z.string().min(1, "Course is required"),
  teacherId: z.string().optional().nullable().default(null),
  dayOfWeek: z.enum(DAYS_OF_WEEK, { errorMap: () => ({ message: "Select a valid day" }) }),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Start time must be in HH:MM format"),
  endTime:   z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "End time must be in HH:MM format"),
  roomId:    z.string().optional().nullable().default(null),
});

const createSlotSchema = baseSlotSchema.refine((d) => d.startTime < d.endTime, {
  message: "End time must be after start time",
  path: ["endTime"],
});

const updateSlotSchema = baseSlotSchema.partial();

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be in YYYY-MM-DD format");

// The calendar anchor: "this course's Session 1 lines up with this date" for a (classId,
// courseId) pair. See course-schedule.model.js / TimetableService.resolveCalendar.
const setCourseScheduleSchema = z.object({
  classId: z.string().min(1, "Class is required"),
  courseId: z.string().min(1, "Course is required"),
  startDate: dateOnly,
});

const calendarRangeSchema = z.object({
  from: dateOnly,
  to: dateOnly,
}).refine((d) => d.from <= d.to, { message: "from must not be after to", path: ["to"] });

// Batched status lookup for the calendar's at-a-glance badges — one request for every visible
// event's (classId, sessionId, date) triple instead of one per card. POST (not a GET with
// comma-joined ids, unlike report.routes.js's /readiness) because occurrences are structured
// triples that can span several different classes at once in a merged teacher calendar, not a
// flat id list under one already-known classId. Capped well above anything a single week/month
// grid could ever render, just to keep a malformed client payload from forcing a huge read.
const sessionStatusBulkSchema = z.object({
  occurrences: z.array(z.object({
    classId:   z.string().min(1),
    sessionId: z.string().min(1),
    date:      dateOnly,
  })).max(500),
});

// One-off "we didn't hold this session" record — see timetable.service.js's
// resolveCoursePlacements for how mode ("shift" = every later session moves forward one slot;
// "merge" = combined onto the very next occurrence instead) plugs into the calendar walk.
const SKIP_MODES = ["shift", "merge"];

const createSkipSchema = z.object({
  classId:   z.string().min(1, "Class is required"),
  courseId:  z.string().min(1, "Course is required"),
  date:      dateOnly,
  sessionId: z.string().min(1, "Session is required"),
  mode:      z.enum(SKIP_MODES, { errorMap: () => ({ message: "Choose Shift or Merge" }) }),
  reason:    z.string().max(300).optional().default(""),
});

module.exports = {
  createSlotSchema, updateSlotSchema, DAYS_OF_WEEK,
  setCourseScheduleSchema, calendarRangeSchema, sessionStatusBulkSchema,
  createSkipSchema, SKIP_MODES,
};
