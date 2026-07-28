const express = require("express");
const {
  getReadiness,
  generateReport,
  listReportsForClassCourse,
  listReportsForLearner,
  getReport,
  updateRemarks,
  publishReport,
} = require("./report.controller");
const { authorize } = require("../../shared/middleware/auth.middleware");

const router = express.Router();

// Teacher/school/admin-facing: which learners in a class/course are ready for a report, and
// the class/course's existing draft+published reports.
router.get("/readiness", authorize("admin", "school", "teacher"), getReadiness);
router.post("/", authorize("admin", "school", "teacher"), generateReport);
router.get("/", authorize("admin", "school", "teacher"), listReportsForClassCourse);
router.patch("/:id", authorize("admin", "school", "teacher"), updateRemarks);
router.post("/:id/publish", authorize("admin", "school", "teacher"), publishReport);

// Learner-facing: this learner's own published reports.
router.get("/learner/mine", authorize("learner"), listReportsForLearner);

// Shared read — a learner reads their own published report, a teacher/school/admin reads any
// report belonging to a class they own.
router.get("/:id", authorize("admin", "school", "teacher", "learner"), getReport);

module.exports = router;
