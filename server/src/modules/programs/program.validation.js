const { z } = require("zod");

// A Program deploys an already-authored program-curriculum (created via the normal curriculum
// Basic Info -> Structure -> Competencies -> Version Control flow, flagged isProgram: true) onto
// a Learning Hub as a real running cohort. It doesn't author anything itself — no name,
// description, course list, or cohort/grade name here: cohorts were already defined on the
// curriculum's Structure step, and program.service.js creates a Class for each one automatically.
// Tech educator and capacity aren't set here either — deployment can create several classes at
// once (one per cohort), so those are per-class decisions made afterward from the Classes module.
const createProgramSchema = z.object({
  curriculumId: z.string().min(1, "Curriculum is required"),
  hubId:        z.string().min(1, "Learning hub is required"),
  startDate:    z.string().min(1, "Start date is required"),
  endDate:      z.string().min(1, "End date is required"),
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
