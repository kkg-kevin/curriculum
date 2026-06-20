const { z } = require("zod");

const periodSchema = z
  .object({
    name: z.string().min(1, "Period name is required"),
    startDate: z.string().min(1, "Start date is required"),
    endDate: z.string().min(1, "End date is required"),
    midTermBreakStartDate: z.string().default(""),
    midTermBreakEndDate: z.string().default(""),
  })
  .superRefine((data, ctx) => {
    if (data.startDate && data.endDate && data.endDate <= data.startDate) {
      ctx.addIssue({
        code: "custom",
        message: "End date must be after start date",
        path: ["endDate"],
      });
    }

    const hasBreakStart = !!data.midTermBreakStartDate;
    const hasBreakEnd = !!data.midTermBreakEndDate;

    if (hasBreakStart && !hasBreakEnd) {
      ctx.addIssue({ code: "custom", message: "Break end date is required", path: ["midTermBreakEndDate"] });
    }
    if (!hasBreakStart && hasBreakEnd) {
      ctx.addIssue({ code: "custom", message: "Break start date is required", path: ["midTermBreakStartDate"] });
    }
    if (hasBreakStart && hasBreakEnd) {
      if (data.midTermBreakEndDate <= data.midTermBreakStartDate) {
        ctx.addIssue({ code: "custom", message: "Break end must be after break start", path: ["midTermBreakEndDate"] });
      }
      if (data.startDate && data.midTermBreakStartDate < data.startDate) {
        ctx.addIssue({ code: "custom", message: "Break must start within the period", path: ["midTermBreakStartDate"] });
      }
      if (data.endDate && data.midTermBreakEndDate > data.endDate) {
        ctx.addIssue({ code: "custom", message: "Break must end before period ends", path: ["midTermBreakEndDate"] });
      }
    }
  });

const FRAMEWORKS = ["CBC", "IGCSE", "IB", "National", "Cambridge", "Custom"];
const CYCLE_MODELS = ["terms", "semesters", "custom"];

const createCurriculumSchema = z.object({
  name: z.string().min(1, "Curriculum name is required").max(100, "Max 100 characters"),
  code: z
    .string()
    .min(1, "Curriculum code is required")
    .max(20, "Max 20 characters")
    .regex(/^[A-Z0-9-]+$/i, "Only letters, numbers, and hyphens"),
  academicYear: z.string().optional().default(""),
  description: z.string().max(500).default(""),
  status: z.enum(["draft", "active"]).default("draft"),
  educationLevel: z.string().optional().default(""),
  gradeFrom: z.string().optional().default(""),
  gradeTo: z.string().optional().default(""),
  framework: z.string().optional().default(""),
  academicCycleModel: z.string().optional().default("terms"),
  periods: z.array(periodSchema).optional().default([]),
});

const updateCurriculumSchema = z.object({
  name: z.string().min(1, "Curriculum name is required").max(100, "Max 100 characters").optional(),
  code: z
    .string()
    .min(1, "Curriculum code is required")
    .max(20, "Max 20 characters")
    .regex(/^[A-Z0-9-]+$/i, "Only letters, numbers, and hyphens")
    .optional(),
  academicYear: z.string().optional(),
  description: z.string().max(500).optional(),
  status: z.enum(["draft", "active"]).optional(),
  educationLevel: z.string().optional(),
  gradeFrom: z.string().optional(),
  gradeTo: z.string().optional(),
  framework: z.string().optional(),
  academicCycleModel: z.string().optional(),
  periods: z.array(periodSchema).optional(),
});

module.exports = { createCurriculumSchema, updateCurriculumSchema, periodSchema };
