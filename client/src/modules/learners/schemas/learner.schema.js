import { z } from "zod";

const baseLearnerSchema = z.object({
  firstName:     z.string().min(1, "First name is required"),
  lastName:      z.string().min(1, "Last name is required"),
  gender:        z.enum(["male", "female", "other"], { required_error: "Gender is required" }),
  dateOfBirth:   z.string().optional().or(z.literal("")),
  nationality:   z.string().optional().or(z.literal("")),
  languages:     z.string().optional().or(z.literal("")),
  // Lets the learner log into the same guardian-owned account by username instead of email.
  username: z.string().trim().min(3, "Username must be at least 3 characters").max(30, "Username must be at most 30 characters")
    .regex(/^[a-zA-Z0-9._-]+$/, "Only letters, numbers, dots, underscores, and hyphens are allowed")
    .optional().or(z.literal("")),
  schoolId:      z.string().default(""),
  classId:       z.string().default(""),
  guardianName:  z.string().min(1, "Guardian name is required"),
  guardianPhone: z.string().min(1, "Guardian phone is required"),
  guardianEmail: z.string().email("Invalid email").optional().or(z.literal("")),
  // Transient — never stored on the learner record. When present, creates or resets the
  // matching guardian's learner-portal login for guardianEmail.
  password:      z.string().min(8, "Password must be at least 8 characters").or(z.literal("")).default(""),
  status:        z.enum(["active", "inactive", "transferred", "graduated"]).default("active"),
});

export const createLearnerSchema = baseLearnerSchema.superRefine((data, ctx) => {
  if (data.password && !data.guardianEmail) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["guardianEmail"], message: "Guardian email is required to set a password" });
  }
});

export const updateLearnerSchema = baseLearnerSchema.partial();
