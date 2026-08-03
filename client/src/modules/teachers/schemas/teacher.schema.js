import { z } from "zod";

export const TEACHER_STATUSES = [
  { value: "active",   label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "on_leave", label: "On Leave" },
];

// Employment classification — placeholders only for now. Captured and stored ahead of the full
// employment/payroll feature (rate amounts, computed pay, etc.), which isn't built yet.
export const EMPLOYMENT_TYPES = [
  { value: "part_time", label: "Part-Time" },
  { value: "full_time", label: "Full-Time" },
];

export const TEACHER_LEVELS = [1, 2, 3, 4, 5].map((n) => ({ value: n, label: `Level ${n}` }));

export const PAYMENT_TERMS = [
  { value: "hourly", label: "Hourly Rate" },
  { value: "daily",  label: "Daily Rate" },
];

export const teacherSchema = z
  .object({
    firstName:  z.string().min(1, "First name is required").max(80),
    lastName:   z.string().min(1, "Last name is required").max(80),
    email:     z.string().email("Invalid email address").or(z.literal("")).default(""),
    // Transient — never stored on the teacher record. When present, creates or resets the
    // matching teacher-portal login for this email.
    password:  z.string().min(8, "Password must be at least 8 characters").or(z.literal("")).default(""),
    phone:     z.string().max(20).default(""),
    status:    z.enum(["active", "inactive", "on_leave"]).default("active"),
    employmentType: z.enum(["part_time", "full_time"]).nullable().default(null),
    teacherLevel:   z.number().int().min(1).max(5).nullable().default(null),
    paymentTerms:   z.enum(["hourly", "daily"]).nullable().default(null),
    photo: z.string().optional().nullable(),
    // Which courses this educator may be assigned to teach — empty means unrestricted (see
    // teacher.validation.js on the server for the full rationale).
    qualifiedCourseIds: z.array(z.string()).default([]),
  })
  .superRefine((data, ctx) => {
    if (data.password && !data.email) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["email"], message: "Email is required to set a password" });
    }
  });
