import { z } from "zod";

export const TEACHER_STATUSES = [
  { value: "active",   label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "on_leave", label: "On Leave" },
];

// How an educator is employed, and so paid (see modules/claims/ and Settings → Educator pay):
// full time is a tag only — full-time educators don't claim; part time claims on one or more of
// PAY_RATE_TYPES, at the workspace's rate for each.
export const EMPLOYMENT_TYPES = [
  { value: "part_time", label: "Part-Time" },
  { value: "full_time", label: "Full-Time" },
];

export const PAY_RATE_TYPES = [
  { value: "hourly", label: "Hourly", hint: "Paid for the hours taught" },
  { value: "session", label: "Per session", hint: "Paid for each session delivered" },
  { value: "daily", label: "Daily", hint: "Paid for each day taught" },
  { value: "base_plus", label: "Base plus", hint: "Its own session rate plus a commission for each learner in the class" },
];

export const TEACHER_LEVELS = [1, 2, 3, 4, 5].map((n) => ({ value: n, label: `Level ${n}` }));

// The old single hourly/daily placeholder — superseded by payRateTypes, kept for older records.
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
    employmentType: z.enum(["part_time", "full_time"]).nullable().default("part_time"),
    payRateTypes: z.array(z.enum(PAY_RATE_TYPES.map((t) => t.value))).default(["session"]),
    teacherLevel:   z.number().int().min(1).max(5).nullable().default(null),
    paymentTerms:   z.enum(["hourly", "daily"]).nullable().default(null),
    // The supervisor account this educator's claims go to — optional (see modules/claims/).
    supervisorId: z.string().nullable().default(null),
    photo: z.string().optional().nullable(),
    // Which courses this educator may be assigned to teach — empty means unrestricted (see
    // teacher.validation.js on the server for the full rationale).
    qualifiedCourseIds: z.array(z.string()).default([]),
  })
  .superRefine((data, ctx) => {
    if (data.password && !data.email) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["email"], message: "Email is required to set a password" });
    }
    if (data.employmentType !== "full_time" && data.payRateTypes.length === 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["payRateTypes"], message: "Choose at least one way this educator is paid" });
    }
  });
