const express = require("express");
const {
  createAssessment,
  getAllAssessments,
  getAssessmentById,
  updateAssessment,
  deleteAssessment,
} = require("./assessment.controller");

const router = express.Router();

router.route("/").get(getAllAssessments).post(createAssessment);
router.route("/:id").get(getAssessmentById).put(updateAssessment).delete(deleteAssessment);

module.exports = router;
