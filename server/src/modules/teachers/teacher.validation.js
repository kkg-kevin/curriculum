const { z } = require("zod");

const TEACHER_STATUSES = ["active", "inactive", "on_leave"];

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
});

const createTeacherSchema = baseTeacherSchema.superRefine((data, ctx) => {
  if (data.password && !data.email) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["email"], message: "Email is required to set a password" });
  }
});

const updateTeacherSchema = baseTeacherSchema.partial();

module.exports = { createTeacherSchema, updateTeacherSchema, TEACHER_STATUSES };
