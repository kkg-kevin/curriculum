import { z } from "zod";

export const ASSESSMENT_TYPES = ["quiz", "exam", "project", "assignment", "observation"];
export const QUESTION_BASED_TYPES = ["quiz", "exam"];
export const TASK_BASED_TYPES = ["assignment", "project"];
export const OBSERVATION_BASED_TYPES = ["observation"];

// Structured: fixed shape, auto-gradable. Unstructured: open-ended, human-graded.
export const STRUCTURED_QUESTION_TYPES = ["mcq", "trueFalse", "matching", "fillBlank", "ordering"];
export const UNSTRUCTURED_QUESTION_TYPES = ["shortAnswer", "essay", "fileUpload", "mediaResponse", "linkSubmission"];
export const QUESTION_TYPES = [...STRUCTURED_QUESTION_TYPES, ...UNSTRUCTURED_QUESTION_TYPES];

export const MEDIA_RESPONSE_TYPES = ["audio", "video", "either"];
export const DEFAULT_RATING_SCALE = ["Not Yet", "Developing", "Proficient"];

export const assessmentSchema = z.object({
  name:         z.string().min(1, "Assessment name is required").max(150, "Max 150 characters"),
  description:  z.string().max(1000, "Max 1000 characters").optional().default(""),
  type:         z.enum(ASSESSMENT_TYPES, { errorMap: () => ({ message: "Select a valid assessment type" }) }),
  instructions: z.string().max(5000, "Max 5000 characters").optional(),
  // Not part of the Assessment record itself — reconciled into assessment-competency
  // links after save. See CreateAssessmentPage/EditAssessmentPage onSubmit.
  competencyIds: z.array(z.string()).optional().default([]),
  // Same pattern as competencyIds, reconciled into assessment-learning-area links.
  learningAreaIds: z.array(z.string()).optional().default([]),
});

export const itemSchema = z.object({
  question:      z.string().min(1, "Question text is required").max(5000, "Max 5000 characters"),
  questionType:  z.enum(QUESTION_TYPES, { errorMap: () => ({ message: "Select a valid question type" }) }),
  points:        z.coerce.number().min(0, "Points must be 0 or more"),
  // mcq
  options:       z.array(z.string().min(1, "Option can't be empty")).optional().default([]),
  // mcq / trueFalse / shortAnswer
  correctAnswer: z.string().optional().default(""),
  // matching
  pairs:         z.array(z.object({ left: z.string().min(1), right: z.string().min(1) })).optional().default([]),
  // fillBlank — one accepted answer per blank, in order
  blanks:        z.array(z.string().min(1, "Blank answer can't be empty")).optional().default([]),
  // ordering — steps in the correct sequence
  sequence:      z.array(z.string().min(1, "Step can't be empty")).optional().default([]),
  // fileUpload
  acceptedFileTypes: z.array(z.string().min(1)).optional().default([]),
  // mediaResponse
  mediaType:     z.enum(MEDIA_RESPONSE_TYPES).optional().default("either"),
})
  .refine((d) => d.questionType !== "mcq" || d.options.length >= 2, { message: "Add at least 2 options", path: ["options"] })
  .refine((d) => d.questionType !== "matching" || d.pairs.length >= 2, { message: "Add at least 2 pairs", path: ["pairs"] })
  .refine((d) => d.questionType !== "fillBlank" || d.blanks.length >= 1, { message: "Add at least 1 blank answer", path: ["blanks"] })
  .refine((d) => d.questionType !== "ordering" || d.sequence.length >= 2, { message: "Add at least 2 steps", path: ["sequence"] });

export const rubricCriterionSchema = z.object({
  criterion:   z.string().min(1, "Criterion name is required").max(200, "Max 200 characters"),
  description: z.string().max(5000, "Max 5000 characters").optional().default(""),
  points:      z.coerce.number().min(0, "Points must be 0 or more"),
});

export const indicatorSchema = z.object({
  text:        z.string().min(1, "Indicator text is required").max(300, "Max 300 characters"),
  ratingScale: z.array(z.string().min(1, "Rating label can't be empty")).min(2, "Need at least 2 rating levels").optional().default(DEFAULT_RATING_SCALE),
});
