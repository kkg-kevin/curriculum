import { z } from "zod";

export const FRAMEWORKS = ["CBC", "8-4-4", "British", "IB", "American", "French", "German", "Custom"];
export const CURRICULUM_TYPES = ["Core", "Complementary", "Substitutional"];

export const curriculumDetailsSchema = z.object({
  name: z.string().min(1, "Curriculum name is required").max(100, "Max 100 characters"),
  code: z
    .string()
    .min(1, "Curriculum code is required")
    .max(20, "Max 20 characters")
    .regex(/^[A-Z0-9-]+$/, "Only letters, numbers, and hyphens"),
  description: z.string().max(500, "Max 500 characters").default(""),
});
