const { z } = require("zod");

// Classes can run any day of the week (23 Nov 2026), as educators' availability always could.
const DAYS_OF_WEEK = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const AVAILABILITY_DAYS = DAYS_OF_WEEK;

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
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Enter a time as HH:MM");
const dayEnum = z.enum(DAYS_OF_WEEK, { errorMap: () => ({ message: "Select a valid day" }) });

// How a change to a lesson that has already run applies: from a date (past sessions stay as they
// happened), or `correctPast` when the old time was simply a mistake.
const slotChangeSchema = z.object({
  applyFrom: dateOnly.optional(),
  correctPast: z.preprocess((v) => v === true || v === "true" || v === "1", z.boolean()).optional(),
});

// The Timetable Planner: one lesson on one or more days, with its educator and start date.
const plannerLessonSchema = z.object({
  classId: z.string().min(1, "Choose a class"),
  courseId: z.string().min(1, "Choose a course"),
  teacherId: z.string().nullable().optional(),
  roomId: z.string().nullable().optional(),
  days: z.array(dayEnum).min(1, "Choose at least one day").max(7),
  startTime: hhmm,
  endTime: hhmm,
  startDate: dateOnly.nullable().optional(),
  slotId: z.string().nullable().optional(),
  applyFrom: dateOnly.nullable().optional(),
  correctPast: z.boolean().optional(),
  confirmMove: z.boolean().optional(),
});

const plannerCopySchema = z.object({
  fromClassId: z.string().min(1),
  toClassIds: z.array(z.string().min(1)).min(1, "Choose at least one class").max(200),
  withDates: z.boolean().optional().default(true),
});

// The calendar anchor: "this course's Session 1 lines up with this date" for a (classId,
// courseId) pair. See course-schedule.model.js / TimetableService.resolveCalendar.
const setCourseScheduleSchema = z.object({
  classId: z.string().min(1, "Class is required"),
  courseId: z.string().min(1, "Course is required"),
  startDate: dateOnly,
  // Moving a start date that sessions were already taught against needs saying so (19 Nov 2026).
  confirmMove: z.boolean().optional(),
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
// "merge" = combined onto the very next occurrence instead; "move" = relocated to an explicit
// newDate, independent of the class's normal weekly slot pattern) plugs into the calendar walk.
const SKIP_MODES = ["shift", "merge", "move"];

const createSkipSchema = z.object({
  classId:   z.string().min(1, "Class is required"),
  courseId:  z.string().min(1, "Course is required"),
  date:      dateOnly,
  sessionId: z.string().min(1, "Session is required"),
  mode:      z.enum(SKIP_MODES, { errorMap: () => ({ message: "Choose Shift, Merge, or Move" }) }),
  reason:    z.string().max(300).optional().default(""),
  // Required (and only meaningful) for mode "move" — the specific date this session relocates
  // to. Left plain-optional rather than required-by-default so shift/merge requests (which never
  // send it) don't need an explicit null.
  newDate:   dateOnly.optional(),
}).refine((d) => d.mode !== "move" || !!d.newDate, {
  message: "Pick the date to move this session to",
  path: ["newDate"],
}).refine((d) => d.mode !== "move" || d.newDate !== d.date, {
  message: "Pick a different date than the original",
  path: ["newDate"],
});

// A close-out action on one session occurrence — see SessionOccurrenceService for what each does.
// "unlock-attendance" is the admin/school-only escape hatch; the controller gates that one further.
const OCCURRENCE_ACTIONS = ["mark-taught", "cancel", "reopen", "lock-attendance", "unlock-attendance"];

const occurrenceActionSchema = z.object({
  action: z.enum(OCCURRENCE_ACTIONS, { errorMap: () => ({ message: "Unknown occurrence action" }) }),
  note: z.string().max(500).optional().default(""),
});

module.exports = {
  AVAILABILITY_DAYS, slotChangeSchema, plannerLessonSchema, plannerCopySchema,
  createSlotSchema, updateSlotSchema, DAYS_OF_WEEK,
  setCourseScheduleSchema, calendarRangeSchema, sessionStatusBulkSchema,
  createSkipSchema, SKIP_MODES,
  occurrenceActionSchema, OCCURRENCE_ACTIONS,
};
