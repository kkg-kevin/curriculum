const AssessmentIssueModel = require("./assessment-issue.model");
const AssessmentSubmissionModel = require("./assessment-submission.model");
const AssessmentModel = require("../assessment.model");
const LearnerModel = require("../../learners/learner.model");
const { requiresManualGrading, computeAutoScore, computeMaxScore } = require("./grading.utils");

function loadAssessmentOrThrow(assessmentId) {
  const assessment = AssessmentModel.findById(assessmentId);
  if (!assessment) {
    const err = new Error("Assessment not found");
    err.statusCode = 404;
    throw err;
  }
  return assessment;
}

const AssessmentSubmissionService = {
  // Issuing is idempotent per (assessment, session, class) — re-issuing (e.g. after editing the
  // due date) updates the existing record instead of creating a duplicate that would otherwise
  // fragment a class's roster view across two issues of "the same" assessment.
  issueAssessment({ assessmentId, sessionId, courseId, classId, issuedBy, dueDate }) {
    loadAssessmentOrThrow(assessmentId);
    const existing = AssessmentIssueModel.findOne({ assessmentId, sessionId, classId });
    if (existing) return AssessmentIssueModel.update(existing.id, { dueDate: dueDate ?? existing.dueDate });
    return AssessmentIssueModel.create({ assessmentId, sessionId, courseId, classId, issuedBy, dueDate: dueDate || null });
  },

  revokeIssue(issueId) {
    return AssessmentIssueModel.delete(issueId);
  },

  getIssue(issueId) {
    return AssessmentIssueModel.findById(issueId);
  },

  getIssuesForClass(classId) {
    return AssessmentIssueModel.findAll({ classId });
  },

  getIssuesForCourse(courseId) {
    return AssessmentIssueModel.findAll({ courseId });
  },

  // What a learner sees: every issue targeting their class, each merged with their own
  // submission (or a synthetic "not_started" placeholder if they haven't opened it yet).
  getIssuedAssessmentsForLearner(classId, learnerId) {
    const issues = AssessmentIssueModel.findAll({ classId });
    return issues.map((issue) => {
      const assessment = AssessmentModel.findById(issue.assessmentId);
      const submission = AssessmentSubmissionModel.findOne({ issueId: issue.id, learnerId });
      return {
        issue,
        assessment,
        submission: submission || { status: "not_started" },
      };
    }).filter((row) => !!row.assessment);
  },

  // Roster view for the teacher grading a class: every enrolled learner, each merged with their
  // submission (or "not_started"). Drives both the class-wide progress summary and the
  // per-learner grading action.
  getRosterForIssue(issueId) {
    const issue = AssessmentIssueModel.findById(issueId);
    if (!issue) {
      const err = new Error("Issue not found");
      err.statusCode = 404;
      throw err;
    }
    const assessment = loadAssessmentOrThrow(issue.assessmentId);
    const learners = LearnerModel.findAll({ classId: issue.classId, status: "active" });
    const submissions = AssessmentSubmissionModel.findAll({ issueId });
    const submissionByLearner = new Map(submissions.map((s) => [s.learnerId, s]));

    const roster = learners.map((learner) => ({
      learner,
      submission: submissionByLearner.get(learner.id) || { status: "not_started" },
    }));

    return { issue, assessment, roster };
  },

  getOrCreateSubmission({ issueId, learnerId, classId }) {
    const issue = AssessmentIssueModel.findById(issueId);
    if (!issue) {
      const err = new Error("Issue not found");
      err.statusCode = 404;
      throw err;
    }
    const existing = AssessmentSubmissionModel.findOne({ issueId, learnerId });
    if (existing) return existing;

    const assessment = loadAssessmentOrThrow(issue.assessmentId);
    return AssessmentSubmissionModel.create({
      issueId,
      assessmentId: issue.assessmentId,
      learnerId,
      classId,
      status: "in_progress",
      answers: [],
      autoScore: null,
      autoMax: null,
      autoItemResults: [],
      manualScore: null,
      totalScore: null,
      maxScore: computeMaxScore(assessment),
      requiresManualGrading: requiresManualGrading(assessment),
      itemFeedback: [],
      overallFeedback: "",
      submittedAt: null,
      gradedAt: null,
      gradedBy: null,
    });
  },

  saveDraft(submissionId, answers) {
    const submission = AssessmentSubmissionModel.findById(submissionId);
    if (!submission) {
      const err = new Error("Submission not found");
      err.statusCode = 404;
      throw err;
    }
    if (submission.status !== "in_progress") {
      const err = new Error("This assessment has already been submitted");
      err.statusCode = 400;
      throw err;
    }
    return AssessmentSubmissionModel.update(submissionId, { answers });
  },

  // Finalizes a learner's attempt. Auto-gradable items are scored immediately either way (the
  // computation itself is cheap and deterministic), but the result is only *released* — status
  // "graded" — when nothing else needs a teacher's input. Otherwise the submission holds at
  // "submitted" and the auto-score sits unreleased until the teacher's grading pass completes
  // and combines both into one release, per the release-together decision this was built around.
  submit(submissionId, answers) {
    const submission = AssessmentSubmissionModel.findById(submissionId);
    if (!submission) {
      const err = new Error("Submission not found");
      err.statusCode = 404;
      throw err;
    }
    if (submission.status !== "in_progress") {
      const err = new Error("This assessment has already been submitted");
      err.statusCode = 400;
      throw err;
    }

    const assessment = loadAssessmentOrThrow(submission.assessmentId);
    const { autoScore, autoMax, itemResults } = computeAutoScore(assessment, answers);
    const needsManual = requiresManualGrading(assessment);

    return AssessmentSubmissionModel.update(submissionId, {
      answers,
      autoScore,
      autoMax,
      autoItemResults: itemResults,
      submittedAt: new Date().toISOString(),
      status: needsManual ? "submitted" : "graded",
      totalScore: needsManual ? null : autoScore,
      gradedAt: needsManual ? null : new Date().toISOString(),
    });
  },

  // Teacher's grading pass — supplies marks/feedback for whatever the learner's answers didn't
  // already auto-grade (rubric criteria, short-answer items, observation indicators, deliverables).
  // Combines with any stored auto-score and releases both together.
  grade(submissionId, { itemFeedback = [], overallFeedback = "", manualScore = 0, gradedBy }) {
    const submission = AssessmentSubmissionModel.findById(submissionId);
    if (!submission) {
      const err = new Error("Submission not found");
      err.statusCode = 404;
      throw err;
    }
    const totalScore = (submission.autoScore || 0) + (Number(manualScore) || 0);

    return AssessmentSubmissionModel.update(submissionId, {
      itemFeedback,
      overallFeedback,
      manualScore: Number(manualScore) || 0,
      totalScore,
      status: "graded",
      gradedAt: new Date().toISOString(),
      gradedBy,
    });
  },

  getSubmission(id) {
    return AssessmentSubmissionModel.findById(id);
  },
};

module.exports = AssessmentSubmissionService;
