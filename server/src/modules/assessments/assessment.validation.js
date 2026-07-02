const { z } = require("zod");

const ASSESSMENT_TYPES = ["quiz", "exam", "project", "assignment"];

const createAssessmentSchema = z.object({
  name:        z.string().min(1, "Assessment name is required").max(150, "Max 150 characters"),
  description: z.string().max(1000, "Max 1000 characters").optional().default(""),
  type:        z.enum(ASSESSMENT_TYPES, { errorMap: () => ({ message: "Select a valid assessment type" }) }),
  status:      z.enum(["active", "inactive"]).default("active"),
});

const updateAssessmentSchema = createAssessmentSchema.partial();

module.exports = { createAssessmentSchema, updateAssessmentSchema, ASSESSMENT_TYPES };
