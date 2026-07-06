const { z } = require("zod");

const ASSESSMENT_TYPES = ["quiz", "exam", "project", "assignment", "observation"];

// Structured: fixed shape, auto-gradable. Unstructured: open-ended, human-graded.
const STRUCTURED_QUESTION_TYPES = ["mcq", "trueFalse", "matching", "fillBlank", "ordering"];
const UNSTRUCTURED_QUESTION_TYPES = ["shortAnswer", "essay", "fileUpload", "mediaResponse", "linkSubmission"];
const QUESTION_TYPES = [...STRUCTURED_QUESTION_TYPES, ...UNSTRUCTURED_QUESTION_TYPES];

const MEDIA_RESPONSE_TYPES = ["audio", "video", "either"];
const DEFAULT_RATING_SCALE = ["Not Yet", "Developing", "Proficient"];

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
  points:       z.number().min(0, "Points must be 0 or more"),
  options:       z.array(z.string().min(1)).optional().default([]),
  correctAnswer: z.string().optional().default(""),
  pairs:         z.array(z.object({ left: z.string().min(1), right: z.string().min(1) })).optional().default([]),
  blanks:        z.array(z.string().min(1)).optional().default([]),
  sequence:      z.array(z.string().min(1)).optional().default([]),
  acceptedFileTypes: z.array(z.string().min(1)).optional().default([]),
  mediaType:     z.enum(MEDIA_RESPONSE_TYPES).optional().default("either"),
})
  .refine((d) => d.questionType !== "mcq" || d.options.length >= 2, { message: "Multiple choice questions need at least 2 options", path: ["options"] })
  .refine((d) => d.questionType !== "matching" || d.pairs.length >= 2, { message: "Matching questions need at least 2 pairs", path: ["pairs"] })
  .refine((d) => d.questionType !== "fillBlank" || d.blanks.length >= 1, { message: "Fill-in-the-blank questions need at least 1 blank answer", path: ["blanks"] })
  .refine((d) => d.questionType !== "ordering" || d.sequence.length >= 2, { message: "Ordering questions need at least 2 steps", path: ["sequence"] });

const createItemSchema = itemSchema;
const updateItemSchema = z.object({
  question:      z.string().min(1).max(5000).optional(),
  questionType:  z.enum(QUESTION_TYPES).optional(),
  points:        z.number().min(0).optional(),
  options:       z.array(z.string().min(1)).optional(),
  correctAnswer: z.string().optional(),
  pairs:         z.array(z.object({ left: z.string().min(1), right: z.string().min(1) })).optional(),
  blanks:        z.array(z.string().min(1)).optional(),
  sequence:      z.array(z.string().min(1)).optional(),
  acceptedFileTypes: z.array(z.string().min(1)).optional(),
  mediaType:     z.enum(MEDIA_RESPONSE_TYPES).optional(),
});

const rubricCriterionSchema = z.object({
  criterion:   z.string().min(1, "Criterion name is required").max(200, "Max 200 characters"),
  description: z.string().max(5000, "Max 5000 characters").optional().default(""),
  points:      z.number().min(0, "Points must be 0 or more"),
});

const createRubricCriterionSchema = rubricCriterionSchema;
const updateRubricCriterionSchema = rubricCriterionSchema.partial();

// Teacher Observation content — a checklist of observable indicators, each rated
// against a scale, rather than scored with points like items/rubric criteria.
const indicatorSchema = z.object({
  text:        z.string().min(1, "Indicator text is required").max(300, "Max 300 characters"),
  ratingScale: z.array(z.string().min(1)).min(2, "Need at least 2 rating levels").optional().default(DEFAULT_RATING_SCALE),
});

const createIndicatorSchema = indicatorSchema;
const updateIndicatorSchema = z.object({
  text:        z.string().min(1).max(300).optional(),
  ratingScale: z.array(z.string().min(1)).min(2).optional(),
});

const linkCompetencySchema = z.object({
  competencyId: z.string().min(1, "competencyId is required"),
});

const linkLearningAreaSchema = z.object({
  learningAreaId: z.string().min(1, "learningAreaId is required"),
});

module.exports = {
  createAssessmentSchema,
  updateAssessmentSchema,
  createItemSchema,
  updateItemSchema,
  createRubricCriterionSchema,
  updateRubricCriterionSchema,
  createIndicatorSchema,
  updateIndicatorSchema,
  linkCompetencySchema,
  linkLearningAreaSchema,
  ASSESSMENT_TYPES,
  QUESTION_TYPES,
  STRUCTURED_QUESTION_TYPES,
  UNSTRUCTURED_QUESTION_TYPES,
  MEDIA_RESPONSE_TYPES,
  DEFAULT_RATING_SCALE,
};
