const AssessmentIssueModel = require("./assessment-issue.model");
const AssessmentSubmissionModel = require("./assessment-submission.model");
const AssessmentModel = require("../assessment.model");
const LearnerModel = require("../../learners/learner.model");
const LearnerHubLinkModel = require("../../learners/learner-hub-link.model");
const CompetencyService = require("../../curriculum/competency-framework/competency.service");
const CompetencyModel = require("../../settings/competencies/competency.model");
const { requiresManualGrading, computeAutoScore, computeMaxScore, computeIndicatorBreakdown } = require("./grading.utils");

function loadAssessmentOrThrow(assessmentId) {
  const assessment = AssessmentModel.findById(assessmentId);
  if (!assessment) {
    const err = new Error("Assessment not found");
    err.statusCode = 404;
    throw err;
  }
  return assessment;
}

// A standalone diagnostic issue (see issueDiagnostic below) carries an ageCategoryId — once a
// submission for it reaches "graded" (either instantly here, via submit()'s auto-grade path, or
// later via a teacher's grade() pass), its score resolves this learner's curriculum-wide
// Performance Band, and the age category it was issued for becomes their confirmed
// Developmental Stage (see CompetencyService.placeLearnerFromDiagnostic). Ordinary class-issued
// assessments have no ageCategoryId, so this is a no-op for them.
// indicatorMarks/indicatorBreakdown only ever store an indicatorId — resolve it back to its
// owning competency plus both names for display, from the global competency catalog
// (indicators aren't curriculum-scoped, so no curriculumId is needed here).
function resolveIndicator(indicatorId) {
  const competencies = CompetencyModel.findAll();
  for (const comp of competencies) {
    const indicator = (comp.indicators || []).find((i) => i.id === indicatorId);
    if (indicator) return { competencyId: comp.id, competencyName: comp.name, indicatorName: indicator.name };
  }
  return null;
}

// Shared by getLearnerIndicatorProgress (all-time) and getLearnerIndicatorProgressForAssessments
// (course-scoped) — sums each indicator's earned/possible marks across the given graded
// submissions and resolves each indicator's display name/competency.
function summarizeIndicatorProgress(submissions) {
  const totals = new Map();
  submissions.forEach((s) => {
    (s.indicatorBreakdown || []).forEach(({ indicatorId, marksEarned, marksPossible }) => {
      const cur = totals.get(indicatorId) || { marksEarned: 0, marksPossible: 0 };
      cur.marksEarned += marksEarned;
      cur.marksPossible += marksPossible;
      totals.set(indicatorId, cur);
    });
  });

  return [...totals.entries()].map(([indicatorId, { marksEarned, marksPossible }]) => {
    const resolved = resolveIndicator(indicatorId);
    return {
      indicatorId,
      competencyId: resolved?.competencyId || null,
      competencyName: resolved?.competencyName || "Unknown",
      indicatorName: resolved?.indicatorName || "Unknown indicator",
      marksEarned: Math.round(marksEarned * 100) / 100,
      marksPossible,
      percent: marksPossible > 0 ? Math.round((marksEarned / marksPossible) * 100) : 0,
    };
  }).sort((a, b) => a.competencyName.localeCompare(b.competencyName) || a.indicatorName.localeCompare(b.indicatorName));
}

function maybePlaceFromDiagnostic(submission) {
  if (submission.status !== "graded") return;
  const issue = AssessmentIssueModel.findById(submission.issueId);
  if (!issue?.learnerId || !issue?.ageCategoryId) return;
  const scorePercent = submission.maxScore > 0 ? (submission.totalScore / submission.maxScore) * 100 : 0;
  CompetencyService.placeLearnerFromDiagnostic(issue.learnerId, issue.ageCategoryId, scorePercent);
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

  // Standalone diagnostic issuance — bypasses the normal course/session attachment entirely
  // (unlike issueAssessment above), since a diagnostic is meant to run before any course is
  // even assigned. Idempotent per (assessment, learner): re-triggering (e.g. re-enrolling)
  // never creates a duplicate. See learner.service.js's maybeAutoIssueDiagnostic for the caller.
  issueDiagnostic({ assessmentId, learnerId, ageCategoryId }) {
    loadAssessmentOrThrow(assessmentId);
    const existing = AssessmentIssueModel.findOneStandalone({ assessmentId, learnerId });
    if (existing) return existing;
    return AssessmentIssueModel.create({
      assessmentId, learnerId, ageCategoryId,
      sessionId: null, courseId: null, classId: null,
      issuedBy: "system", dueDate: null,
    });
  },

  // A learner has just finished every other section of a course session — see
  // SectionViewPage.jsx's areNonAssessmentSectionsComplete check, the client-side trigger for
  // this (there's no server-side course-progress tracking to fire it from instead). Same
  // "bypass class/session issuance" pattern as issueDiagnostic, but keyed to the course/session
  // that triggered it instead of an age category. Idempotent per (assessment, learner).
  issueOnSessionComplete({ assessmentId, learnerId, courseId, sessionId }) {
    loadAssessmentOrThrow(assessmentId);
    const existing = AssessmentIssueModel.findOneStandalone({ assessmentId, learnerId });
    if (existing) return existing;
    return AssessmentIssueModel.create({
      assessmentId, learnerId, courseId, sessionId,
      classId: null, issuedBy: "system", dueDate: null,
    });
  },

  // Every standalone issue (diagnostic or course-progress-triggered) targeting this learner
  // directly, merged with their own submission — the learnerId-keyed counterpart to
  // getIssuedAssessmentsForLearner above, which is keyed by class instead.
  getStandaloneIssuedAssessments(learnerId) {
    const issues = AssessmentIssueModel.findAll({ learnerId });
    return issues.map((issue) => {
      const assessment = AssessmentModel.findById(issue.assessmentId);
      const submission = AssessmentSubmissionModel.findOne({ issueId: issue.id, learnerId });
      return { issue, assessment, submission: submission || { status: "not_started" } };
    }).filter((row) => !!row.assessment);
  },

  // This learner's most recent auto-issued diagnostic, if any — drives the "Diagnostic
  // Assessment" card on LearnerViewPage. Filtered to ageCategoryId specifically, since a
  // learner can now also hold course-progress-triggered standalone issues (see
  // issueOnSessionComplete above) that share the same learnerId-keyed issue shape.
  getDiagnosticForLearner(learnerId) {
    return AssessmentSubmissionService.getStandaloneIssuedAssessments(learnerId)
      .find((row) => !!row.issue.ageCategoryId) || null;
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

  // Cross-cutting "needs grading" queue for a class — every submitted-but-ungraded submission
  // across every issue in the class, each merged with its learner/assessment for display. The
  // inverse of getRosterForIssue (which is per-issue, every learner); this is per-class, only the
  // ones actually awaiting a teacher's review, so a teacher doesn't have to open each assessment's
  // roster individually to find pending work.
  getSubmissionsNeedingGrading(classId) {
    const submissions = AssessmentSubmissionModel.findAll({ classId, status: "submitted" });
    return submissions.map((submission) => ({
      submission,
      issue: AssessmentIssueModel.findById(submission.issueId),
      assessment: AssessmentModel.findById(submission.assessmentId),
      learner: LearnerModel.findById(submission.learnerId),
    })).filter((row) => !!row.issue && !!row.assessment && !!row.learner);
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
    // classId/status no longer live on the learner record — resolve the roster via enrollment
    // links for this class instead (see learner-hub-link.model.js).
    const learnerIds = LearnerHubLinkModel.findByClassId(issue.classId)
      .filter((l) => l.status === "active")
      .map((l) => l.learnerId);
    const learners = LearnerModel.findAll({ ids: learnerIds });
    const submissions = AssessmentSubmissionModel.findAll({ issueId });
    const submissionByLearner = new Map(submissions.map((s) => [s.learnerId, s]));

    const roster = learners.map((learner) => ({
      learner,
      submission: submissionByLearner.get(learner.id) || { status: "not_started" },
    }));

    return { issue, assessment, roster };
  },

  getOrCreateSubmission({ issueId, learnerId }) {
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
      // The issue itself already carries which class it was issued to — that's the
      // authoritative source, not any field on the learner record.
      classId: issue.classId,
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
      // A graded submission's score/feedback stays hidden from the learner until this flips —
      // see grade()/submit()/publishReport for exactly when that happens.
      reportPublished: false,
      reportPublishedAt: null,
      reportPublishedBy: null,
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
    // Fully auto-gradable assessments release straight to "graded" here — their competency
    // breakdown is exact from the auto results alone, no manual itemFeedback exists yet.
    const indicatorBreakdown = needsManual ? [] : computeIndicatorBreakdown(assessment, itemResults, []);

    // Fully auto-gradable assessments have no teacher step to gate on, so their report releases
    // in the same instant as grading — only a submission a teacher actually grades (see grade())
    // goes through the separate publishReport step.
    const updated = AssessmentSubmissionModel.update(submissionId, {
      answers,
      autoScore,
      autoMax,
      autoItemResults: itemResults,
      submittedAt: new Date().toISOString(),
      status: needsManual ? "submitted" : "graded",
      totalScore: needsManual ? null : autoScore,
      gradedAt: needsManual ? null : new Date().toISOString(),
      indicatorBreakdown: needsManual ? submission.indicatorBreakdown || [] : indicatorBreakdown,
      ...(needsManual ? {} : { reportPublished: true, reportPublishedAt: new Date().toISOString() }),
    });
    maybePlaceFromDiagnostic(updated);
    return updated;
  },

  // Teacher's grading pass — supplies marks/feedback for whatever the learner's answers didn't
  // already auto-grade (rubric criteria, short-answer items, observation indicators, deliverables).
  // Combines with any stored auto-score. A class-issued submission's grade is saved here but kept
  // hidden from the learner until the teacher explicitly calls publishReport — a standalone
  // submission (diagnostic/course-progress-triggered) has no roster UI built around that extra
  // step, so it keeps releasing instantly like before.
  grade(submissionId, { itemFeedback = [], overallFeedback = "", manualScore = 0, gradedBy }) {
    const submission = AssessmentSubmissionModel.findById(submissionId);
    if (!submission) {
      const err = new Error("Submission not found");
      err.statusCode = 404;
      throw err;
    }
    const assessment = loadAssessmentOrThrow(submission.assessmentId);
    const totalScore = (submission.autoScore || 0) + (Number(manualScore) || 0);
    const indicatorBreakdown = computeIndicatorBreakdown(assessment, submission.autoItemResults, itemFeedback);
    const isStandalone = !submission.classId;

    const graded = AssessmentSubmissionModel.update(submissionId, {
      itemFeedback,
      overallFeedback,
      manualScore: Number(manualScore) || 0,
      totalScore,
      status: "graded",
      gradedAt: new Date().toISOString(),
      gradedBy,
      indicatorBreakdown,
      ...(isStandalone ? { reportPublished: true, reportPublishedAt: new Date().toISOString(), reportPublishedBy: gradedBy } : {}),
    });
    maybePlaceFromDiagnostic(graded);
    return graded;
  },

  // Releases an already-graded, class-issued submission's score/feedback to the learner — a
  // separate step from grade() so a teacher can grade privately, review, then choose when the
  // learner actually sees it. Idempotent: publishing an already-published report is a no-op.
  publishReport(submissionId, publishedBy) {
    const submission = AssessmentSubmissionModel.findById(submissionId);
    if (!submission) {
      const err = new Error("Submission not found");
      err.statusCode = 404;
      throw err;
    }
    if (submission.status !== "graded") {
      const err = new Error("This submission hasn't been graded yet");
      err.statusCode = 400;
      throw err;
    }
    if (submission.reportPublished) return submission;
    return AssessmentSubmissionModel.update(submissionId, {
      reportPublished: true,
      reportPublishedAt: new Date().toISOString(),
      reportPublishedBy: publishedBy,
    });
  },

  getSubmission(id) {
    return AssessmentSubmissionModel.findById(id);
  },

  // Accumulating, per-learner view across every graded submission they've ever had — sums each
  // indicator's earned/possible marks across every assessment that touched it (see
  // computeIndicatorBreakdown in grading.utils.js), rather than a single point-in-time
  // snapshot. This is what finally gives the Progress Arc's indicator engine real per-learner
  // data (see CompetencyService.calculateIndicatorProgress) instead of the empty, manually-set
  // achievement store it had before.
  getLearnerIndicatorProgress(learnerId) {
    return summarizeIndicatorProgress(AssessmentSubmissionModel.findAll({ learnerId, status: "graded" }));
  },

  // Same aggregation, narrowed to one course's worth of assessments — the reports module's
  // "indicator breakdown within this course" view, reusing the exact indicator-resolution logic
  // above rather than duplicating it. Only counts assessments whose own report has already been
  // published to the learner — a course report shouldn't reveal a score the learner hasn't seen
  // released on its own assessment page yet.
  getLearnerIndicatorProgressForAssessments(learnerId, assessmentIds) {
    const submissions = AssessmentSubmissionModel.findAll({ learnerId, status: "graded" })
      .filter((s) => assessmentIds.includes(s.assessmentId) && s.reportPublished);
    return summarizeIndicatorProgress(submissions);
  },
};

module.exports = AssessmentSubmissionService;
