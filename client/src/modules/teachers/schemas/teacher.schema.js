import { z } from "zod";

export const TEACHER_STATUSES = [
  { value: "active",   label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "on_leave", label: "On Leave" },
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
  })
  .superRefine((data, ctx) => {
    if (data.password && !data.email) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["email"], message: "Email is required to set a password" });
    }
  });
