import { z } from "zod";

export const ASSESSMENT_TYPES = ["quiz", "exam", "project", "assignment", "observation"];
export const QUESTION_BASED_TYPES = ["quiz", "exam"];
export const TASK_BASED_TYPES = ["assignment", "project"];
export const OBSERVATION_BASED_TYPES = ["observation"];
export const QUESTION_TYPES = ["mcq", "trueFalse", "shortAnswer"];
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
  options:       z.array(z.string().min(1, "Option can't be empty")).optional().default([]),
  correctAnswer: z.string().optional().default(""),
  points:        z.coerce.number().min(0, "Points must be 0 or more"),
}).refine(
  (data) => data.questionType !== "mcq" || data.options.length >= 2,
  { message: "Add at least 2 options", path: ["options"] }
);

export const rubricCriterionSchema = z.object({
  criterion:   z.string().min(1, "Criterion name is required").max(200, "Max 200 characters"),
  description: z.string().max(5000, "Max 5000 characters").optional().default(""),
  points:      z.coerce.number().min(0, "Points must be 0 or more"),
});

export const indicatorSchema = z.object({
  text:        z.string().min(1, "Indicator text is required").max(300, "Max 300 characters"),
  ratingScale: z.array(z.string().min(1, "Rating label can't be empty")).min(2, "Need at least 2 rating levels").optional().default(DEFAULT_RATING_SCALE),
});
