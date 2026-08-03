const { z } = require("zod");

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

module.exports = {
  createTeacherSchema, updateTeacherSchema, TEACHER_STATUSES,
  EMPLOYMENT_TYPES, TEACHER_LEVELS, PAYMENT_TERMS,
};
