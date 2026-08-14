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

// Whether this teacher has at least one course-educator link in the given class — the one
// precision level every teacher-facing ownership check in this file uses, whether the class is
// known directly (assertClassAccess) or reached indirectly through a learner's enrollment
// (assertLearnerHubAccess).
async function teacherLinkedToClass(req, classId) {
  const links = await ClassCourseTeacherLinkModel.findByClassId(classId);
  return links.some((l) => l.teacherId === req.ownTeacher?.id);
}

// Issuing/grading/roster-viewing all revolve around a class — reuse the exact ownership check
// classes/attendance already apply, so a teacher can only ever touch a class they have at least
// one course-educator link in, and a school only its own school's classes.
async function assertClassAccess(req, cls) {
  if (!cls) {
    const err = new Error("Class not found");
    err.statusCode = 404;
    throw err;
  }
  if (req.user.role === "school")  assertOwn(cls.schoolId === req.ownSchool?.id);
  if (req.user.role === "teacher") assertOwn(await teacherLinkedToClass(req, cls.id));
}

// A standalone diagnostic submission (see issueDiagnostic in assessment-submission.service.js)
// has no classId, so assertClassAccess doesn't apply — ownership instead comes from whether
// the learner is enrolled at a hub/class this caller owns. A "teacher" caller has no hub of
// their own, so their access comes from the learner's class instead — same "any course-link in
// the class is enough" precision assertClassAccess already uses for ordinary class-issued
// grading, not narrowed down to the specific Learning Area's courses.
async function assertLearnerHubAccess(req, learnerId) {
  if (req.user.role === "school") {
    const links = await LearnerHubLinkModel.findByLearnerId(learnerId);
    const hubIds = links.map((l) => l.hubId);
    assertOwn(hubIds.some((hubId) => isOwnHub(req, hubId)));
  } else if (req.user.role === "teacher") {
    const links = await LearnerHubLinkModel.findByLearnerId(learnerId);
    const classIds = links.filter((l) => l.classId).map((l) => l.classId);
    const results = await Promise.all(classIds.map((classId) => teacherLinkedToClass(req, classId)));
    assertOwn(results.some(Boolean));
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

// Shared by getSubmission/gradeSubmission/publishSubmissionReport — a class-issued submission
// checks ownership via its class, a standalone one (diagnostic/course-progress, no classId) via
// the learner's own hub/class links instead.
async function assertSubmissionAccess(req, submission) {
  if (submission.classId) {
    await assertClassAccess(req, await ClassModel.findById(submission.classId));
  } else {
    await assertLearnerHubAccess(req, submission.learnerId);
  }
}

// Shared by getIssuesForClass/getSubmissionsNeedingGrading/getStandaloneSubmissionsNeedingGrading
// — every one of them is "resolve the classId query param, require it, then prove this caller
// owns that class" before doing anything else.
async function requireOwnedClassFromQuery(req) {
  const { classId } = req.query;
  if (!classId) {
    const err = new Error("classId is required");
    err.statusCode = 400;
    throw err;
  }
  const cls = await ClassModel.findById(classId);
  await assertClassAccess(req, cls);
  return cls;
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
  const cls = await ClassModel.findById(data.classId);
  await assertClassAccess(req, cls);
  const issue = await AssessmentSubmissionService.issueAssessment({ ...data, issuedBy: req.ownTeacher?.id || req.user.id });
  res.status(201).json({ success: true, data: issue });
});

const getIssuesForClass = asyncHandler(async (req, res) => {
  const cls = await requireOwnedClassFromQuery(req);
  const issues = await AssessmentSubmissionService.getIssuesForClass(cls.id);
  res.json({ success: true, data: issues, count: issues.length });
});

// The teacher's cross-cutting "needs grading" queue for one class — see
// getSubmissionsNeedingGrading in the service for why this is separate from a per-issue roster.
const getSubmissionsNeedingGrading = asyncHandler(async (req, res) => {
  const cls = await requireOwnedClassFromQuery(req);
  const rows = await AssessmentSubmissionService.getSubmissionsNeedingGrading(cls.id);
  res.json({ success: true, data: rows, count: rows.length });
});

// Teacher-facing counterpart to getSubmissionsNeedingGrading — see
// getStandaloneSubmissionsNeedingGrading in the service for why this is separate.
const getStandaloneSubmissionsNeedingGrading = asyncHandler(async (req, res) => {
  const cls = await requireOwnedClassFromQuery(req);
  const rows = await AssessmentSubmissionService.getStandaloneSubmissionsNeedingGrading(cls.id);
  res.json({ success: true, data: rows, count: rows.length });
});

const getRosterForIssue = asyncHandler(async (req, res) => {
  const { issue, assessment, roster, groups, ungroupedLearners } = await AssessmentSubmissionService.getRosterForIssue(req.params.id);
  const cls = await ClassModel.findById(issue.classId);
  await assertClassAccess(req, cls);
  res.json({ success: true, data: { issue, assessment, roster, groups, ungroupedLearners } });
});

const revokeIssue = asyncHandler(async (req, res) => {
  const issue = await AssessmentSubmissionService.getIssue(req.params.id);
  if (!issue) {
    const err = new Error("Issue not found");
    err.statusCode = 404;
    throw err;
  }
  const cls = await ClassModel.findById(issue.classId);
  await assertClassAccess(req, cls);
  await AssessmentSubmissionService.revokeIssue(req.params.id);
  res.json({ success: true });
});

// Learner's own issued-assessments list — scoped entirely off their own enrollment links,
// never off a client-supplied classId, so a learner can't read another class's assignments.
// A learner can now be enrolled in several classes at once, so this merges every active
// enrollment's issued assessments into one list rather than assuming a single class.
const getIssuedForLearner = asyncHandler(async (req, res) => {
  const learner = req.ownLearner;
  if (!learner) return res.json({ success: true, data: [] });
  const rawRows = await AssessmentSubmissionService.getIssuedRowsForLearner(learner.id);
  const rows = rawRows.map((row) => ({ ...row, submission: redactUnpublishedReport(row.submission) }));
  res.json({ success: true, data: rows, count: rows.length });
});

// Admin/school-facing: this learner's auto-issued diagnostic (if any), for the Diagnostic
// Assessment card on LearnerViewPage. Also learner-facing (own record only) — the learner-
// portal's first-login diagnostic gate reads this directly, scoped to its own curriculum via
// ?curriculumId, so a learner's Stage diagnostic from a different hub never leaks in.
const getDiagnosticForLearner = asyncHandler(async (req, res) => {
  if (req.user.role === "learner") {
    assertOwn(req.params.learnerId === req.ownLearner?.id);
  } else {
    await assertLearnerHubAccess(req, req.params.learnerId);
  }
  const row = await AssessmentSubmissionService.getDiagnosticForLearner(req.params.learnerId, req.query.curriculumId || null);
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
    await assertLearnerHubAccess(req, req.params.learnerId);
  }
  const rows = await AssessmentSubmissionService.getLearningAreaDiagnosticsForLearner(req.params.learnerId);
  res.json({ success: true, data: rows, count: rows.length });
});

// A learner reading their own accumulating competency progress, or an admin/school reviewing
// it for a learner in their own hub — same access shape as the diagnostic card.
const getLearnerIndicatorProgress = asyncHandler(async (req, res) => {
  const learnerId = req.params.learnerId;
  if (req.user.role === "learner") {
    assertOwn(learnerId === req.ownLearner?.id);
  } else {
    await assertLearnerHubAccess(req, learnerId);
  }
  const rows = await AssessmentSubmissionService.getLearnerIndicatorProgress(learnerId, req.query.curriculumId || null);
  res.json({ success: true, data: rows, count: rows.length });
});

// Learner-facing: fired client-side the moment SectionViewPage.jsx detects every other
// section of a session is complete — issues that session's attached assessment(s) to this
// learner alone (see issueOnSessionComplete), independent of classmates' own progress.
const issueOnSessionComplete = asyncHandler(async (req, res) => {
  const learner = req.ownLearner;
  assertOwn(!!learner);
  const data = issueOnSessionCompleteSchema.parse(req.body);
  const issue = await AssessmentSubmissionService.issueOnSessionComplete({ ...data, learnerId: learner.id });
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
  const submission = await AssessmentSubmissionService.getOrCreateSubmission({ issueId, learnerId: learner.id });
  res.status(201).json({ success: true, data: submission });
});

const saveDraft = asyncHandler(async (req, res) => {
  const existing = await AssessmentSubmissionService.getSubmission(req.params.id);
  assertLearnerOwnsSubmission(req, existing);
  const { answers } = submitAnswersSchema.parse(req.body);
  const submission = await AssessmentSubmissionService.saveDraft(req.params.id, answers);
  res.json({ success: true, data: submission });
});

const submitAnswers = asyncHandler(async (req, res) => {
  const existing = await AssessmentSubmissionService.getSubmission(req.params.id);
  assertLearnerOwnsSubmission(req, existing);
  const { answers } = submitAnswersSchema.parse(req.body);
  const submission = await AssessmentSubmissionService.submit(req.params.id, answers);
  res.json({ success: true, data: submission });
});

const getSubmission = asyncHandler(async (req, res) => {
  const submission = await AssessmentSubmissionService.getSubmission(req.params.id);
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
  await assertSubmissionAccess(req, submission);
  res.json({ success: true, data: submission });
});

const gradeSubmission = asyncHandler(async (req, res) => {
  const existing = await AssessmentSubmissionService.getSubmission(req.params.id);
  if (!existing) {
    const err = new Error("Submission not found");
    err.statusCode = 404;
    throw err;
  }
  await assertSubmissionAccess(req, existing);
  const data = gradeSubmissionSchema.parse(req.body);
  const submission = await AssessmentSubmissionService.grade(req.params.id, { ...data, gradedBy: req.ownTeacher?.id || req.user.id });
  res.json({ success: true, data: submission });
});

// Teacher's explicit "make this grade visible to the learner" action — same ownership shape as
// gradeSubmission, since only whoever could grade it should be able to release it.
const publishSubmissionReport = asyncHandler(async (req, res) => {
  const existing = await AssessmentSubmissionService.getSubmission(req.params.id);
  if (!existing) {
    const err = new Error("Submission not found");
    err.statusCode = 404;
    throw err;
  }
  await assertSubmissionAccess(req, existing);
  const submission = await AssessmentSubmissionService.publishReport(req.params.id, req.ownTeacher?.id || req.user.id);
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
