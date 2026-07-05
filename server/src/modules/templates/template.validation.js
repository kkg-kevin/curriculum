const { z } = require("zod");
const { ASSESSMENT_TYPES, QUESTION_TYPES, DEFAULT_RATING_SCALE } = require("../assessments/assessment.validation");

// Mirrors the live assessment's item/rubric/indicator shapes (assessment.validation.js)
// but without an "id" — ids are assigned fresh each time a template is applied.
const templateItemSchema = z.object({
  question:      z.string().min(1, "Question text is required").max(5000),
  questionType:  z.enum(QUESTION_TYPES, { errorMap: () => ({ message: "Select a valid question type" }) }),
  options:       z.array(z.string().min(1)).optional().default([]),
  correctAnswer: z.string().optional().default(""),
  points:        z.number().min(0).optional().default(1),
});

const templateRubricCriterionSchema = z.object({
  criterion:   z.string().min(1, "Criterion name is required").max(200),
  description: z.string().max(5000).optional().default(""),
  points:      z.number().min(0).optional().default(0),
});

const templateIndicatorSchema = z.object({
  text:        z.string().min(1, "Indicator text is required").max(300),
  ratingScale: z.array(z.string().min(1)).min(2).optional().default(DEFAULT_RATING_SCALE),
});

const createTemplateSchema = z.object({
  name:         z.string().min(1, "Template name is required").max(150),
  type:         z.enum(ASSESSMENT_TYPES, { errorMap: () => ({ message: "Select a valid assessment type" }) }),
  description:  z.string().max(1000).optional().default(""),
  instructions: z.string().max(5000).optional().default(""),
  items:        z.array(templateItemSchema).optional().default([]),
  rubric:       z.array(templateRubricCriterionSchema).optional().default([]),
  indicators:   z.array(templateIndicatorSchema).optional().default([]),
});

const updateTemplateSchema = createTemplateSchema.partial();

module.exports = {
  createTemplateSchema,
  updateTemplateSchema,
};
