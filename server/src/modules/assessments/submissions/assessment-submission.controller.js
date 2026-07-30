const asyncHandler = require("express-async-handler");
const AssessmentSubmissionService = require("./assessment-submission.service");
const ClassModel = require("../../classes/class.model");
const LearnerHubLinkModel = require("../../learners/learner-hub-link.model");
const ClassCourseTeacherLinkModel = require("../../classes/class-course-teacher-link.model");
const { assertOwn, isOwnHub } = require("../../../shared/middleware/scope.middleware");
const {
  issueAssessmentSchema,
  issueOnSessionCompleteSchema,
  submitAnswersSchema,
  gradeSubmissionSchema,
} = require("./assessment-submission.validation");

// Issuing/grading/roster-viewing all revolve around a class — reuse the exact ownership check
// classes/attendance already apply, so a teacher can only ever touch a class they have at least
// one course-educator link in, and a school only its own school's classes.
function assertClassAccess(req, cls) {
  if (!cls) {
    const err = new Error("Class not found");
    err.statusCode = 404;
    throw err;
  }
  if (req.user.role === "school")  assertOwn(cls.schoolId === req.ownSchool?.id);
  if (req.user.role === "teacher") {
    assertOwn(ClassCourseTeacherLinkModel.findByClassId(cls.id).some((l) => l.teacherId === req.ownTeacher?.id));
  }
}

// A standalone diagnostic submission (see issueDiagnostic in assessment-submission.service.js)
// has no classId, so assertClassAccess doesn't apply — ownership instead comes from whether
// the learner is enrolled at a hub/class this caller owns. A "teacher" caller has no hub of
// their own, so their access comes from the learner's class instead — same "any course-link in
// the class is enough" precision assertClassAccess already uses for ordinary class-issued
// grading, not narrowed down to the specific Learning Area's courses.
function assertLearnerHubAccess(req, learnerId) {
  if (req.user.role === "school") {
    const hubIds = LearnerHubLinkModel.findByLearnerId(learnerId).map((l) => l.hubId);
    assertOwn(hubIds.some((hubId) => isOwnHub(req, hubId)));
  } else if (req.user.role === "teacher") {
    const classIds = LearnerHubLinkModel.findByLearnerId(learnerId).filter((l) => l.classId).map((l) => l.classId);
    assertOwn(classIds.some((classId) => ClassCourseTeacherLinkModel.findByClassId(classId).some((l) => l.teacherId === req.ownTeacher?.id)));
  }
}

function assertLearnerOwnsSubmission(req, submission) {
  if (!submission) {
    const err = new Error("Submission not found");
    err.statusCode = 404;
    throw err;
  }
  if (req.user.role === "learner") assertOwn(submission.learnerId === req.ownLearner?.id);
}

// A class-issued submission is graded internally (status "graded") as soon as a teacher saves
// marks, but stays hidden from the learner until the teacher separately calls publishReport (see
// assessment-submission.service.js) — presented here as still "submitted" so every existing
// learner-facing UI, which only ever branches on status, needs no changes to respect the gate.
// Only ever applied for the "learner" role — admin/school/teacher always see the real state.
function redactUnpublishedReport(submission) {
  if (submission.status !== "graded" || submission.reportPublished) return submission;
  return {
    ...submission,
    status: "submitted",
    totalScore: null,
    autoScore: null,
    manualScore: null,
    autoItemResults: [],
    itemFeedback: [],
    overallFeedback: "",
    indicatorBreakdown: [],
    gradedAt: null,
    gradedBy: null,
  };
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

// The teacher's cross-cutting "needs grading" queue for one class — see
// getSubmissionsNeedingGrading in the service for why this is separate from a per-issue roster.
const getSubmissionsNeedingGrading = asyncHandler(async (req, res) => {
  const { classId } = req.query;
  if (!classId) {
    const err = new Error("classId is required");
    err.statusCode = 400;
    throw err;
  }
  const cls = ClassModel.findById(classId);
  assertClassAccess(req, cls);
  const rows = AssessmentSubmissionService.getSubmissionsNeedingGrading(classId);
  res.json({ success: true, data: rows, count: rows.length });
});

// Teacher-facing counterpart to getSubmissionsNeedingGrading — see
// getStandaloneSubmissionsNeedingGrading in the service for why this is separate.
const getStandaloneSubmissionsNeedingGrading = asyncHandler(async (req, res) => {
  const { classId } = req.query;
  if (!classId) {
    const err = new Error("classId is required");
    err.statusCode = 400;
    throw err;
  }
  const cls = ClassModel.findById(classId);
  assertClassAccess(req, cls);
  const rows = AssessmentSubmissionService.getStandaloneSubmissionsNeedingGrading(classId);
  res.json({ success: true, data: rows, count: rows.length });
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
  const classRows = classIds.flatMap((classId) => AssessmentSubmissionService.getIssuedAssessmentsForLearner(classId, learner.id));
  // Standalone issues (e.g. a course-progress-triggered one) target the learner directly, with
  // no class involved at all — merged in alongside the class-issued ones. Diagnostics
  // (ageCategoryId/learningAreaId set) are excluded: those are exclusively the first-login
  // gate's concern (FirstLoginDiagnosticGate.jsx) and, once taken, shouldn't resurface as a
  // regular assessment in the learner's portal.
  const standaloneRows = AssessmentSubmissionService.getStandaloneIssuedAssessments(learner.id)
    .filter((row) => !row.issue.ageCategoryId && !row.issue.learningAreaId);
  const rows = [...standaloneRows, ...classRows].map((row) => ({ ...row, submission: redactUnpublishedReport(row.submission) }));
  res.json({ success: true, data: rows, count: rows.length });
});

// Admin/school-facing: this learner's auto-issued diagnostic (if any), for the Diagnostic
// Assessment card on LearnerViewPage.
const getDiagnosticForLearner = asyncHandler(async (req, res) => {
  assertLearnerHubAccess(req, req.params.learnerId);
  const row = AssessmentSubmissionService.getDiagnosticForLearner(req.params.learnerId);
  res.json({ success: true, data: row });
});

// Same access shape as getDiagnosticForLearner, plural — this learner's Learning-Area
// diagnostics, for the Learning Journey section of LearnerViewPage. Also readable by the
// learner themselves (their own record only) — the learner-portal's first-login diagnostic
// gate uses this same endpoint rather than a separate one.
const getLearningAreaDiagnosticsForLearner = asyncHandler(async (req, res) => {
  if (req.user.role === "learner") {
    assertOwn(req.params.learnerId === req.ownLearner?.id);
  } else {
    assertLearnerHubAccess(req, req.params.learnerId);
  }
  const rows = AssessmentSubmissionService.getLearningAreaDiagnosticsForLearner(req.params.learnerId);
  res.json({ success: true, data: rows, count: rows.length });
});

// A learner reading their own accumulating competency progress, or an admin/school reviewing
// it for a learner in their own hub — same access shape as the diagnostic card.
const getLearnerIndicatorProgress = asyncHandler(async (req, res) => {
  const learnerId = req.params.learnerId;
  if (req.user.role === "learner") {
    assertOwn(learnerId === req.ownLearner?.id);
  } else {
    assertLearnerHubAccess(req, learnerId);
  }
  const rows = AssessmentSubmissionService.getLearnerIndicatorProgress(learnerId);
  res.json({ success: true, data: rows, count: rows.length });
});

// Learner-facing: fired client-side the moment SectionViewPage.jsx detects every other
// section of a session is complete — issues that session's attached assessment(s) to this
// learner alone (see issueOnSessionComplete), independent of classmates' own progress.
const issueOnSessionComplete = asyncHandler(async (req, res) => {
  const learner = req.ownLearner;
  assertOwn(!!learner);
  const data = issueOnSessionCompleteSchema.parse(req.body);
  const issue = AssessmentSubmissionService.issueOnSessionComplete({ ...data, learnerId: learner.id });
  res.status(201).json({ success: true, data: issue });
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
    res.json({ success: true, data: redactUnpublishedReport(submission) });
    return;
  }
  if (submission.classId) {
    const cls = ClassModel.findById(submission.classId);
    assertClassAccess(req, cls);
  } else {
    assertLearnerHubAccess(req, submission.learnerId);
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
  if (existing.classId) {
    const cls = ClassModel.findById(existing.classId);
    assertClassAccess(req, cls);
  } else {
    assertLearnerHubAccess(req, existing.learnerId);
  }
  const data = gradeSubmissionSchema.parse(req.body);
  const submission = AssessmentSubmissionService.grade(req.params.id, { ...data, gradedBy: req.ownTeacher?.id || req.user.id });
  res.json({ success: true, data: submission });
});

// Teacher's explicit "make this grade visible to the learner" action — same ownership shape as
// gradeSubmission, since only whoever could grade it should be able to release it.
const publishSubmissionReport = asyncHandler(async (req, res) => {
  const existing = AssessmentSubmissionService.getSubmission(req.params.id);
  if (!existing) {
    const err = new Error("Submission not found");
    err.statusCode = 404;
    throw err;
  }
  if (existing.classId) {
    const cls = ClassModel.findById(existing.classId);
    assertClassAccess(req, cls);
  } else {
    assertLearnerHubAccess(req, existing.learnerId);
  }
  const submission = AssessmentSubmissionService.publishReport(req.params.id, req.ownTeacher?.id || req.user.id);
  res.json({ success: true, data: submission });
});

module.exports = {
  issueAssessment,
  getIssuesForClass,
  getSubmissionsNeedingGrading,
  getStandaloneSubmissionsNeedingGrading,
  getRosterForIssue,
  revokeIssue,
  getIssuedForLearner,
  getDiagnosticForLearner,
  getLearningAreaDiagnosticsForLearner,
  getLearnerIndicatorProgress,
  issueOnSessionComplete,
  getOrCreateSubmission,
  saveDraft,
  submitAnswers,
  getSubmission,
  gradeSubmission,
  publishSubmissionReport,
};
