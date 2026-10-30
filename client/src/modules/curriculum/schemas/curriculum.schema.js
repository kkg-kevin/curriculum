import { z } from "zod";

export const FRAMEWORKS = ["CBC", "8-4-4", "British", "IB", "American", "French", "German", "Custom"];
export const CURRICULUM_TYPES = ["Core", "Complementary", "Substitutional"];

export const curriculumDetailsSchema = z.object({
  name: z.string().min(1, "Curriculum name is required").max(100, "Max 100 characters"),
  code: z
    .string()
    .trim()
    .min(1, "Curriculum code is required")
    .max(20, "Max 20 characters"),
  // Rich text (TipTap HTML) — capped generously above the old 500-char plain-text limit.
  description: z.string().max(5000, "Max 5000 characters").default(""),
  // Training of trainers: "educators" — a TOT curriculum, offered only to educators.
  audience: z.enum(["learners", "educators"]).default("learners"),
  completionTeacherLevel: z.union([z.coerce.number().int().min(1).max(5), z.literal(""), z.null()]).optional().transform((v) => (v === "" || v == null ? null : v)),
});
