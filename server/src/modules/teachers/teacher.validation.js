const { z } = require("zod");
const { DAYS_OF_WEEK } = require("../timetable/timetable.validation");

const TEACHER_STATUSES = ["active", "inactive", "on_leave"];

// Employment classification fields — placeholders only for now. Captured and stored so the
// data exists once the full employment/payroll feature (rate amounts, computed pay, etc.) is
// built; nothing here computes or uses these values yet.
const EMPLOYMENT_TYPES = ["part_time", "full_time"];
const TEACHER_LEVELS = [1, 2, 3, 4, 5];
const PAYMENT_TERMS = ["hourly", "daily"];

const baseTeacherSchema = z.object({
  firstName:  z.string().min(1, "First name is required").max(80),
  lastName:   z.string().min(1, "Last name is required").max(80),
  email:      z.string().email("Invalid email address").or(z.literal("")).default(""),
  // Transient — never persisted onto the teacher record. When present, creates or resets the
  // matching teacher-portal login for this teacher's email (see auth.service.js's
  // setOrCreatePassword), then gets stripped before the teacher record is saved.
  password:   z.string().min(8, "Password must be at least 8 characters").or(z.literal("")).default(""),
  phone:      z.string().max(20).default(""),
  status:     z.enum(TEACHER_STATUSES).default("active"),
  employmentType: z.enum(EMPLOYMENT_TYPES).optional().nullable().default(null),
  teacherLevel:   z.number().int().min(1).max(5).optional().nullable().default(null),
  paymentTerms:   z.enum(PAYMENT_TERMS).optional().nullable().default(null),
  photo: z.string().optional().nullable().default(null),
  // Which Course records this teacher may be assigned to teach (see class.controller.js's
  // assignCourseTeacher) — Course ids are global, never scoped per curriculum/grade, so this is
  // unambiguous system-wide. Empty means unrestricted: a teacher with no qualifications tagged
  // can still be assigned to any course, exactly like before this field existed. The restriction
  // only activates once an admin gives a teacher a specific, non-empty list.
  qualifiedCourseIds: z.array(z.string()).default([]),
});

const createTeacherSchema = baseTeacherSchema.superRefine((data, ctx) => {
  if (data.password && !data.email) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["email"], message: "Email is required to set a password" });
  }
});

const updateTeacherSchema = baseTeacherSchema.partial();

// Dedicated status toggle — separate from the general update so a plain "deactivate" action
// doesn't have to round-trip the whole record, and so the route can be authorized on its own.
const updateTeacherStatusSchema = z.object({
  status: z.enum(TEACHER_STATUSES),
});

// A weekly recurring "I can teach during this window" row — same day/time shape timetable
// slots use, minus the class/course/room fields that don't apply to a standing availability
// declaration. See teacher-availability.model.js / TimetableService's hasConflict extension for
// how this feeds into actual scheduling.
const baseAvailabilitySchema = z.object({
  dayOfWeek: z.enum(DAYS_OF_WEEK, { errorMap: () => ({ message: "Select a valid day" }) }),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Start time must be in HH:MM format"),
  endTime:   z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "End time must be in HH:MM format"),
});

const createAvailabilitySlotSchema = baseAvailabilitySchema.refine((d) => d.startTime < d.endTime, {
  message: "End time must be after start time",
  path: ["endTime"],
});

const updateAvailabilitySlotSchema = baseAvailabilitySchema.partial();

module.exports = {
  createTeacherSchema, updateTeacherSchema, updateTeacherStatusSchema, TEACHER_STATUSES,
  EMPLOYMENT_TYPES, TEACHER_LEVELS, PAYMENT_TERMS,
  createAvailabilitySlotSchema, updateAvailabilitySlotSchema,
};
