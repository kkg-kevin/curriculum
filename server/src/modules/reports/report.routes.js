const express = require("express");
const {
  getReadiness,
  getHubAnalytics,
  generateReport,
  listReportsForClassCourse,
  listReportsForLearner,
  getReport,
  updateRemarks,
  publishReport,
  unpublishReport,
} = require("./report.controller");
const { authorize } = require("../../shared/middleware/auth.middleware");

const router = express.Router();

// Teacher/school/admin-facing: which learners in a class/course are ready for a report, and
// the class/course's existing draft+published reports.
router.get("/readiness", authorize("admin", "school", "teacher"), getReadiness);
// Hub-wide academic performance rollup for the school portal's Reports page — must stay above
// the "/:id" route below, or "hub-analytics" gets swallowed as an :id lookup.
router.get("/hub-analytics", authorize("admin", "school"), getHubAnalytics);
router.post("/", authorize("admin", "school", "teacher"), generateReport);
router.get("/", authorize("admin", "school", "teacher"), listReportsForClassCourse);
router.patch("/:id", authorize("admin", "school", "teacher"), updateRemarks);
router.post("/:id/publish", authorize("admin", "school", "teacher"), publishReport);
// Withdraws a published report back to draft — see unpublishReport in report.service.js.
router.post("/:id/unpublish", authorize("admin", "school", "teacher"), unpublishReport);

// Learner-facing: this learner's own published reports.
router.get("/learner/mine", authorize("learner"), listReportsForLearner);

// Shared read — a learner reads their own published report, a teacher/school/admin reads any
// report belonging to a class they own.
router.get("/:id", authorize("admin", "school", "teacher", "learner"), getReport);

module.exports = router;
