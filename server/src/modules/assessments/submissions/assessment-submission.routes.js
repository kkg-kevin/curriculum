const express = require("express");
const {
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
  startObservationSubmission,
  gradeMilestone,
  saveDraft,
  submitAnswers,
  getSubmission,
  gradeSubmission,
  publishSubmissionReport,
} = require("./assessment-submission.controller");
const { authorize } = require("../../../shared/middleware/auth.middleware");

const router = express.Router();

// Issuing/roster/grading is a teacher-facing action (school/admin can do it too, for
// cross-school support); ownership is enforced in the controller off the class the issue
// targets, same pattern as attendance/classes.
router.post("/issues", authorize("admin", "school", "teacher"), issueAssessment);
router.get("/issues", authorize("admin", "school", "teacher"), getIssuesForClass);
// Cross-cutting "needs grading" queue for a class — see getSubmissionsNeedingGrading.
router.get("/needs-grading", authorize("admin", "school", "teacher"), getSubmissionsNeedingGrading);
// Same, but for standalone diagnostic submissions (classId: null) belonging to learners in this
// class — see getStandaloneSubmissionsNeedingGrading in the service.
router.get("/diagnostics-needing-grading", authorize("admin", "school", "teacher"), getStandaloneSubmissionsNeedingGrading);
router.get("/issues/:id/roster", authorize("admin", "school", "teacher"), getRosterForIssue);
// Teacher-initiated start of a Teacher Observation submission — the one assessment type with no
// learner-facing "take" step, since the teacher records it directly (see
// startObservationSubmission's comment in the controller). Rejects any other assessment type.
router.post("/issues/:id/start-observation", authorize("admin", "school", "teacher"), startObservationSubmission);
// Grades one milestone of a project assessment — see gradeMilestone's comment in the
// controller. Independent of the submission's own draft/submit/grade flow below.
router.post("/issues/:id/milestones/:milestoneId", authorize("admin", "school", "teacher"), gradeMilestone);
router.delete("/issues/:id", authorize("admin", "school", "teacher"), revokeIssue);
router.patch("/submissions/:id/grade", authorize("admin", "school", "teacher"), gradeSubmission);
// Releases an already-graded submission's score/feedback to the learner — a separate step from
// grading itself, see publishReport in assessment-submission.service.js.
router.post("/submissions/:id/publish-report", authorize("admin", "school", "teacher"), publishSubmissionReport);

// A specific learner's auto-issued Stage diagnostic (standalone, no class involved). Also
// learner-facing (own record only, enforced in the controller) — the portal's first-login gate
// reads this directly, scoped to its own curriculum via ?curriculumId.
router.get("/diagnostic/:learnerId", authorize("admin", "school", "learner"), getDiagnosticForLearner);
// Same, plural — every Learning-Area diagnostic this learner currently holds. Also learner-
// facing (own record only, enforced in the controller) — the portal's first-login gate reads
// this directly rather than duplicating the query.
router.get("/diagnostic/learning-areas/:learnerId", authorize("admin", "school", "learner"), getLearningAreaDiagnosticsForLearner);

// A learner's own accumulating competency progress, or an admin/school reviewing it.
router.get("/learner/:learnerId/competency-progress", authorize("admin", "school", "learner"), getLearnerIndicatorProgress);

// Learner-facing: what's issued to them, and their own attempt.
router.get("/learner/issued", authorize("learner"), getIssuedForLearner);
// Fired client-side when a learner finishes every other section of a course session —
// see SectionViewPage.jsx's areNonAssessmentSectionsComplete check.
router.post("/issues/course-progress", authorize("learner"), issueOnSessionComplete);
router.post("/submissions", authorize("learner"), getOrCreateSubmission);
router.patch("/submissions/:id/draft", authorize("learner"), saveDraft);
router.post("/submissions/:id/submit", authorize("learner"), submitAnswers);

// Shared read — a learner reads their own submission (feedback view), a teacher/school/admin
// reads any submission belonging to a class they own.
router.get("/submissions/:id", authorize("admin", "school", "teacher", "learner"), getSubmission);

module.exports = router;
