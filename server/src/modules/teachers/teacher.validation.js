const { z } = require("zod");

const QUALIFICATIONS = [
  "Certificate",
  "Diploma",
  "Bachelor's Degree",
  "Postgraduate Diploma",
  "Master's Degree",
  "Doctorate",
];

const TEACHER_STATUSES = ["active", "inactive", "on_leave"];

const createTeacherSchema = z.object({
  firstName:     z.string().min(1, "First name is required").max(80),
  lastName:      z.string().min(1, "Last name is required").max(80),
  employeeId:    z.string().min(1, "Employee ID is required").max(30)
                   .regex(/^[A-Z0-9-]+$/i, "Letters, numbers, and hyphens only"),
  email:         z.string().email("Invalid email address").or(z.literal("")).default(""),
  phone:         z.string().max(20).default(""),
  schoolId:      z.string().min(1, "School is required"),
  subjects:      z.array(z.string()).default([]),
  qualification: z.enum(QUALIFICATIONS).or(z.literal("")).default(""),
  status:        z.enum(TEACHER_STATUSES).default("active"),
});

const updateTeacherSchema = createTeacherSchema.partial();

module.exports = { createTeacherSchema, updateTeacherSchema, QUALIFICATIONS, TEACHER_STATUSES };
