const express = require("express");
const {
  issueAssessment,
  getIssuesForClass,
  getSubmissionsNeedingGrading,
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
router.get("/issues/:id/roster", authorize("admin", "school", "teacher"), getRosterForIssue);
router.delete("/issues/:id", authorize("admin", "school", "teacher"), revokeIssue);
router.patch("/submissions/:id/grade", authorize("admin", "school", "teacher"), gradeSubmission);
// Releases an already-graded submission's score/feedback to the learner — a separate step from
// grading itself, see publishReport in assessment-submission.service.js.
router.post("/submissions/:id/publish-report", authorize("admin", "school", "teacher"), publishSubmissionReport);

// Admin/school-facing: a specific learner's auto-issued diagnostic (standalone, no class involved).
router.get("/diagnostic/:learnerId", authorize("admin", "school"), getDiagnosticForLearner);
// Same, plural — every Learning-Area diagnostic this learner currently holds.
router.get("/diagnostic/learning-areas/:learnerId", authorize("admin", "school"), getLearningAreaDiagnosticsForLearner);

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
