import { z } from "zod";

export const TEACHER_STATUSES = [
  { value: "active",   label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "on_leave", label: "On Leave" },
];

export const teacherSchema = z.object({
  firstName:  z.string().min(1, "First name is required").max(80),
  lastName:   z.string().min(1, "Last name is required").max(80),
  employeeId: z
    .string()
    .min(1, "Employee ID is required")
    .max(30, "Max 30 characters")
    .regex(/^[A-Z0-9-]+$/i, "Letters, numbers, and hyphens only"),
  email:     z.string().email("Invalid email address").or(z.literal("")).default(""),
  phone:     z.string().max(20).default(""),
  schoolId:  z.string().min(1, "School is required"),
  status:    z.enum(["active", "inactive", "on_leave"]).default("active"),
});
