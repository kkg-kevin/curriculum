const { z } = require("zod");
const { ASSESSMENT_TYPES, QUESTION_TYPES, MEDIA_RESPONSE_TYPES, DEFAULT_RATING_SCALE } = require("../assessments/assessment.validation");

// Mirrors the live assessment's item/rubric/indicator shapes (assessment.validation.js)
// but without an "id" — ids are assigned fresh each time a template is applied.
const templateItemSchema = z.object({
  question:      z.string().min(1, "Question text is required").max(5000),
  questionType:  z.enum(QUESTION_TYPES, { errorMap: () => ({ message: "Select a valid question type" }) }),
  points:        z.number().min(0).optional().default(1),
  options:       z.array(z.string().min(1)).optional().default([]),
  correctAnswer: z.string().optional().default(""),
  pairs:         z.array(z.object({ left: z.string().min(1), right: z.string().min(1) })).optional().default([]),
  blanks:        z.array(z.string().min(1)).optional().default([]),
  sequence:      z.array(z.string().min(1)).optional().default([]),
  acceptedFileTypes: z.array(z.string().min(1)).optional().default([]),
  mediaType:     z.enum(MEDIA_RESPONSE_TYPES).optional().default("either"),
})
  .refine((d) => d.questionType !== "mcq" || d.options.length >= 2, { message: "Add at least 2 options", path: ["options"] })
  .refine((d) => d.questionType !== "matching" || d.pairs.length >= 2, { message: "Add at least 2 pairs", path: ["pairs"] })
  .refine((d) => d.questionType !== "fillBlank" || d.blanks.length >= 1, { message: "Add at least 1 blank answer", path: ["blanks"] })
  .refine((d) => d.questionType !== "ordering" || d.sequence.length >= 2, { message: "Add at least 2 steps", path: ["sequence"] });

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
