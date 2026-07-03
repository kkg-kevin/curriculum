const { z } = require("zod");

const ASSESSMENT_TYPES = ["quiz", "exam", "project", "assignment"];
const QUESTION_TYPES = ["mcq", "trueFalse", "shortAnswer"];

const createAssessmentSchema = z.object({
  name:         z.string().min(1, "Assessment name is required").max(150, "Max 150 characters"),
  description:  z.string().max(1000, "Max 1000 characters").optional().default(""),
  type:         z.enum(ASSESSMENT_TYPES, { errorMap: () => ({ message: "Select a valid assessment type" }) }),
  instructions: z.string().max(5000, "Max 5000 characters").optional(),
});

const updateAssessmentSchema = createAssessmentSchema.partial();

const itemSchema = z.object({
  question:     z.string().min(1, "Question text is required").max(5000, "Max 5000 characters"),
  questionType: z.enum(QUESTION_TYPES, { errorMap: () => ({ message: "Select a valid question type" }) }),
  options:      z.array(z.string().min(1)).optional().default([]),
  correctAnswer: z.string().optional().default(""),
  points:       z.number().min(0, "Points must be 0 or more"),
}).refine(
  (data) => data.questionType !== "mcq" || data.options.length >= 2,
  { message: "Multiple choice questions need at least 2 options", path: ["options"] }
);

const createItemSchema = itemSchema;
const updateItemSchema = z.object({
  question:      z.string().min(1).max(5000).optional(),
  questionType:  z.enum(QUESTION_TYPES).optional(),
  options:       z.array(z.string().min(1)).optional(),
  correctAnswer: z.string().optional(),
  points:        z.number().min(0).optional(),
});

const rubricCriterionSchema = z.object({
  criterion:   z.string().min(1, "Criterion name is required").max(200, "Max 200 characters"),
  description: z.string().max(5000, "Max 5000 characters").optional().default(""),
  points:      z.number().min(0, "Points must be 0 or more"),
});

const createRubricCriterionSchema = rubricCriterionSchema;
const updateRubricCriterionSchema = rubricCriterionSchema.partial();

module.exports = {
  createAssessmentSchema,
  updateAssessmentSchema,
  createItemSchema,
  updateItemSchema,
  createRubricCriterionSchema,
  updateRubricCriterionSchema,
  ASSESSMENT_TYPES,
  QUESTION_TYPES,
};
