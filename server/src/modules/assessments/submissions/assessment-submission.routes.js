const express = require("express");
const {
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
} = require("./assessment-submission.controller");
const { authorize } = require("../../../shared/middleware/auth.middleware");

const router = express.Router();

// Issuing/roster/grading is a teacher-facing action (school/admin can do it too, for
// cross-school support); ownership is enforced in the controller off the class the issue
// targets, same pattern as attendance/classes.
router.post("/issues", authorize("admin", "school", "teacher"), issueAssessment);
router.get("/issues", authorize("admin", "school", "teacher"), getIssuesForClass);
router.get("/issues/:id/roster", authorize("admin", "school", "teacher"), getRosterForIssue);
router.delete("/issues/:id", authorize("admin", "school", "teacher"), revokeIssue);
router.patch("/submissions/:id/grade", authorize("admin", "school", "teacher"), gradeSubmission);

// Learner-facing: what's issued to them, and their own attempt.
router.get("/learner/issued", authorize("learner"), getIssuedForLearner);
router.post("/submissions", authorize("learner"), getOrCreateSubmission);
router.patch("/submissions/:id/draft", authorize("learner"), saveDraft);
router.post("/submissions/:id/submit", authorize("learner"), submitAnswers);

// Shared read — a learner reads their own submission (feedback view), a teacher/school/admin
// reads any submission belonging to a class they own.
router.get("/submissions/:id", authorize("admin", "school", "teacher", "learner"), getSubmission);

module.exports = router;
