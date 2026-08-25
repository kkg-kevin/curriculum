const { z } = require("zod");

const issueAssessmentSchema = z.object({
  assessmentId: z.string().min(1),
  sessionId:    z.string().min(1),
  courseId:     z.string().min(1),
  classId:      z.string().min(1),
  dueDate:      z.string().optional().nullable(),
  // Optional duration in minutes, starting the instant a learner's submission is first created
  // (see assessment-submission.service.js's isExpired) — independent of dueDate, which only
  // gates when the assessment must be STARTED by, not how long a learner has once they begin.
  timeLimitMinutes: z.number().int().positive().max(1440, "Time limit can't exceed 24 hours").optional().nullable(),
  // Left as plain .optional() (no .default()) so an omitted value means "don't touch this on
  // re-issue" rather than an implicit false — see issueAssessment in the service.
  groupMode:    z.boolean().optional(),
});

// A learner has just completed every other section of this session — see
// SectionViewPage.jsx's areNonAssessmentSectionsComplete check, the client-side trigger for
// this (there's no server-side progress tracking to fire it from instead).
const issueOnSessionCompleteSchema = z.object({
  assessmentId: z.string().min(1),
  courseId:     z.string().min(1),
  sessionId:    z.string().min(1),
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

// When an item/rubric criterion is tagged to one or more competency indicators
// (indicatorMarks on the assessment content itself), the teacher enters marks per indicator
// here instead of one flat number — see GradingPanel.jsx's per-indicator inputs. `marks` above
// still carries the combined total (indicatorMarks summed) for backward-compatible totalScore
// math; untagged items just send `marks` with an empty indicatorMarks array.
const indicatorMarkFeedbackSchema = z.object({
  indicatorId: z.string().min(1),
  marks:       z.number().min(0),
});

const itemFeedbackSchema = z.object({
  itemId:  z.string().min(1),
  marks:   z.number().min(0).optional().default(0),
  comment: z.string().max(5000).optional().default(""),
  indicatorMarks: z.array(indicatorMarkFeedbackSchema).optional().default([]),
  // Which of the entry's scoringCriteria checkboxes were checked (see GradingPanel.jsx's
  // ScoringCriteriaChecklist) — purely so reopening a graded submission restores checkbox
  // state. `marks` above is still the number scoring actually runs on.
  checkedCriteriaIds: z.array(z.string()).optional().default([]),
});

const gradeSubmissionSchema = z.object({
  itemFeedback:    z.array(itemFeedbackSchema).optional().default([]),
  overallFeedback: z.string().max(5000).optional().default(""),
  manualScore:     z.number().min(0).optional().default(0),
});

// Teacher-initiated start of a Teacher Observation submission — see
// startObservationSubmission in the controller.
const startObservationSchema = z.object({
  learnerId: z.string().min(1, "Learner is required"),
});

// One project milestone's grade — see gradeMilestone in the controller/service.
const gradeMilestoneSchema = z.object({
  learnerId: z.string().min(1, "Learner is required"),
  marks:     z.number().min(0).optional().default(0),
  feedback:  z.string().max(5000).optional().default(""),
});

// Teacher reissuing a graded assessment to one learner — see reissueToLearner in the service.
const reissueSchema = z.object({
  learnerId: z.string().min(1, "Learner is required"),
  dueDate:   z.string().optional().nullable(),
  timeLimitMinutes: z.number().int().positive().max(1440, "Time limit can't exceed 24 hours").optional().nullable(),
});

module.exports = {
  issueAssessmentSchema,
  issueOnSessionCompleteSchema,
  submitAnswersSchema,
  gradeSubmissionSchema,
  startObservationSchema,
  gradeMilestoneSchema,
  reissueSchema,
};
