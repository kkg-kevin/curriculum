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
  room:      z.string().max(100).optional().default(""),
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

module.exports = {
  createSlotSchema, updateSlotSchema, DAYS_OF_WEEK,
  setCourseScheduleSchema, calendarRangeSchema,
};
