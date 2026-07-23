const asyncHandler = require("express-async-handler");
const AssessmentSubmissionService = require("./assessment-submission.service");
const ClassModel = require("../../classes/class.model");
const LearnerHubLinkModel = require("../../learners/learner-hub-link.model");
const { assertOwn } = require("../../../shared/middleware/scope.middleware");
const {
  issueAssessmentSchema,
  submitAnswersSchema,
  gradeSubmissionSchema,
} = require("./assessment-submission.validation");

// Issuing/grading/roster-viewing all revolve around a class — reuse the exact ownership check
// classes/attendance already apply, so a teacher can only ever touch their own class teacher
// assignment and a school only its own school's classes.
function assertClassAccess(req, cls) {
  if (!cls) {
    const err = new Error("Class not found");
    err.statusCode = 404;
    throw err;
  }
  if (req.user.role === "school")  assertOwn(cls.schoolId === req.ownSchool?.id);
  if (req.user.role === "teacher") assertOwn(cls.classTeacherId === req.ownTeacher?.id);
}

function assertLearnerOwnsSubmission(req, submission) {
  if (!submission) {
    const err = new Error("Submission not found");
    err.statusCode = 404;
    throw err;
  }
  if (req.user.role === "learner") assertOwn(submission.learnerId === req.ownLearner?.id);
}

const issueAssessment = asyncHandler(async (req, res) => {
  const data = issueAssessmentSchema.parse(req.body);
  const cls = ClassModel.findById(data.classId);
  assertClassAccess(req, cls);
  const issue = AssessmentSubmissionService.issueAssessment({ ...data, issuedBy: req.ownTeacher?.id || req.user.id });
  res.status(201).json({ success: true, data: issue });
});

const getIssuesForClass = asyncHandler(async (req, res) => {
  const { classId } = req.query;
  if (!classId) {
    const err = new Error("classId is required");
    err.statusCode = 400;
    throw err;
  }
  const cls = ClassModel.findById(classId);
  assertClassAccess(req, cls);
  const issues = AssessmentSubmissionService.getIssuesForClass(classId);
  res.json({ success: true, data: issues, count: issues.length });
});

const getRosterForIssue = asyncHandler(async (req, res) => {
  const { issue, assessment, roster } = AssessmentSubmissionService.getRosterForIssue(req.params.id);
  const cls = ClassModel.findById(issue.classId);
  assertClassAccess(req, cls);
  res.json({ success: true, data: { issue, assessment, roster } });
});

const revokeIssue = asyncHandler(async (req, res) => {
  const issue = AssessmentSubmissionService.getIssue(req.params.id);
  if (!issue) {
    const err = new Error("Issue not found");
    err.statusCode = 404;
    throw err;
  }
  const cls = ClassModel.findById(issue.classId);
  assertClassAccess(req, cls);
  AssessmentSubmissionService.revokeIssue(req.params.id);
  res.json({ success: true });
});

// Learner's own issued-assessments list — scoped entirely off their own enrollment links,
// never off a client-supplied classId, so a learner can't read another class's assignments.
// A learner can now be enrolled in several classes at once, so this merges every active
// enrollment's issued assessments into one list rather than assuming a single class.
const getIssuedForLearner = asyncHandler(async (req, res) => {
  const learner = req.ownLearner;
  if (!learner) return res.json({ success: true, data: [] });
  const classIds = LearnerHubLinkModel.findByLearnerId(learner.id)
    .filter((l) => l.classId && l.status === "active")
    .map((l) => l.classId);
  const rows = classIds.flatMap((classId) => AssessmentSubmissionService.getIssuedAssessmentsForLearner(classId, learner.id));
  res.json({ success: true, data: rows, count: rows.length });
});

const getOrCreateSubmission = asyncHandler(async (req, res) => {
  const { issueId } = req.body;
  if (!issueId) {
    const err = new Error("issueId is required");
    err.statusCode = 400;
    throw err;
  }
  const learner = req.ownLearner;
  assertOwn(!!learner);
  const submission = AssessmentSubmissionService.getOrCreateSubmission({ issueId, learnerId: learner.id });
  res.status(201).json({ success: true, data: submission });
});

const saveDraft = asyncHandler(async (req, res) => {
  const existing = AssessmentSubmissionService.getSubmission(req.params.id);
  assertLearnerOwnsSubmission(req, existing);
  const { answers } = submitAnswersSchema.parse(req.body);
  const submission = AssessmentSubmissionService.saveDraft(req.params.id, answers);
  res.json({ success: true, data: submission });
});

const submitAnswers = asyncHandler(async (req, res) => {
  const existing = AssessmentSubmissionService.getSubmission(req.params.id);
  assertLearnerOwnsSubmission(req, existing);
  const { answers } = submitAnswersSchema.parse(req.body);
  const submission = AssessmentSubmissionService.submit(req.params.id, answers);
  res.json({ success: true, data: submission });
});

const getSubmission = asyncHandler(async (req, res) => {
  const submission = AssessmentSubmissionService.getSubmission(req.params.id);
  if (!submission) {
    const err = new Error("Submission not found");
    err.statusCode = 404;
    throw err;
  }
  if (req.user.role === "learner") {
    assertOwn(submission.learnerId === req.ownLearner?.id);
  } else {
    const cls = ClassModel.findById(submission.classId);
    assertClassAccess(req, cls);
  }
  res.json({ success: true, data: submission });
});

const gradeSubmission = asyncHandler(async (req, res) => {
  const existing = AssessmentSubmissionService.getSubmission(req.params.id);
  if (!existing) {
    const err = new Error("Submission not found");
    err.statusCode = 404;
    throw err;
  }
  const cls = ClassModel.findById(existing.classId);
  assertClassAccess(req, cls);
  const data = gradeSubmissionSchema.parse(req.body);
  const submission = AssessmentSubmissionService.grade(req.params.id, { ...data, gradedBy: req.ownTeacher?.id || req.user.id });
  res.json({ success: true, data: submission });
});

module.exports = {
  issueAssessment,
  getIssuesForClass,
  getRosterForIssue,
  revokeIssue,
  getIssuedForLearner,
  getOrCreateSubmission,
  saveDraft,
  submitAnswers,
  getSubmission,
  gradeSubmission,
};
