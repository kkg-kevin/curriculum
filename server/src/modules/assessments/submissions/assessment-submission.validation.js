const { z } = require("zod");

const issueAssessmentSchema = z.object({
  assessmentId: z.string().min(1),
  sessionId:    z.string().min(1),
  courseId:     z.string().min(1),
  classId:      z.string().min(1),
  dueDate:      z.string().optional().nullable(),
});

// `response` shape depends on the item kind (string for mcq/trueFalse, string[] for
// fillBlank/ordering, {left,right}[] for matching) — validated loosely here since the
// server-side grader in grading.utils.js is what actually interprets it per kind.
const answerSchema = z.object({
  itemId:   z.string().min(1),
  response: z.any(),
});

const submitAnswersSchema = z.object({
  answers: z.array(answerSchema).default([]),
});

const itemFeedbackSchema = z.object({
  itemId:  z.string().min(1),
  marks:   z.number().min(0).optional().default(0),
  comment: z.string().max(5000).optional().default(""),
});

const gradeSubmissionSchema = z.object({
  itemFeedback:    z.array(itemFeedbackSchema).optional().default([]),
  overallFeedback: z.string().max(5000).optional().default(""),
  manualScore:     z.number().min(0).optional().default(0),
});

module.exports = {
  issueAssessmentSchema,
  submitAnswersSchema,
  gradeSubmissionSchema,
};
