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
  academicYear: z.string().min(1, "Academic year is required"),
  description: z.string().default(""),
  framework: z.enum(FRAMEWORKS, {
    errorMap: () => ({ message: "Please select a curriculum framework" }),
  }),
  academicCycleModel: z.enum(CYCLE_MODELS, {
    errorMap: () => ({ message: "Please select an academic cycle model" }),
  }),
  periods: z.array(periodSchema).min(1, "At least one academic period is required"),
});

const updateCurriculumSchema = createCurriculumSchema.partial();

module.exports = { createCurriculumSchema, updateCurriculumSchema, periodSchema };
