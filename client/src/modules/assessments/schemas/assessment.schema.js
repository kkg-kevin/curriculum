import { z } from "zod";

export const ASSESSMENT_STATUSES = ["active", "inactive"];
export const ASSESSMENT_TYPES = ["quiz", "exam", "project", "assignment"];

export const assessmentSchema = z.object({
  name:        z.string().min(1, "Assessment name is required").max(150, "Max 150 characters"),
  description: z.string().max(1000, "Max 1000 characters").optional().default(""),
  type:        z.enum(ASSESSMENT_TYPES, { errorMap: () => ({ message: "Select a valid assessment type" }) }),
  status:      z.enum(["active", "inactive"]).default("active"),
});
