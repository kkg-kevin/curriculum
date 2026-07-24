const { z } = require("zod");

// A Program deploys an already-authored program-curriculum (created via the normal curriculum
// Basic Info -> Structure -> Competencies -> Version Control flow, flagged isProgram: true) onto
// a Learning Hub as a real running cohort. It doesn't author anything itself — no name,
// description, or course list here, all of that already lives on the curriculum. See
// program.service.js for how this turns into a Class.
const createProgramSchema = z.object({
  curriculumId:   z.string().min(1, "Curriculum is required"),
  hubId:          z.string().min(1, "Learning hub is required"),
  gradeName:      z.string().min(1, "Cohort/grade is required"),
  startDate:      z.string().min(1, "Start date is required"),
  endDate:        z.string().min(1, "End date is required"),
  classTeacherId: z.string().or(z.literal("")).nullable().default(null),
  capacity:       z.number().int().positive().nullable().optional().default(null),
}).superRefine((data, ctx) => {
  if (data.endDate <= data.startDate) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["endDate"], message: "End date must be after start date" });
  }
});

const updateProgramSchema = z.object({
  startDate: z.string().min(1).optional(),
  endDate:   z.string().min(1).optional(),
}).superRefine((data, ctx) => {
  if (data.startDate && data.endDate && data.endDate <= data.startDate) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["endDate"], message: "End date must be after start date" });
  }
});

module.exports = { createProgramSchema, updateProgramSchema };
