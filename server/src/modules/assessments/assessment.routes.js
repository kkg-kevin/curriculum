const express = require("express");
const {
  createAssessment,
  getAllAssessments,
  getAssessmentById,
  updateAssessment,
  deleteAssessment,
  getAssessmentCompetencies,
  linkCompetency,
  unlinkCompetency,
  addItem,
  updateItem,
  deleteItem,
  addRubricCriterion,
  updateRubricCriterion,
  deleteRubricCriterion,
} = require("./assessment.controller");

const router = express.Router();

router.route("/").get(getAllAssessments).post(createAssessment);
router.route("/:id").get(getAssessmentById).put(updateAssessment).delete(deleteAssessment);

// Competencies — this assessment's tagged competencies (authored globally under /api/competencies)
router.route("/:id/competencies/links").get(getAssessmentCompetencies).post(linkCompetency);
router.route("/:id/competencies/links/:competencyId").delete(unlinkCompetency);

router.route("/:id/items").post(addItem);
router.route("/:id/items/:itemId").put(updateItem).delete(deleteItem);

router.route("/:id/rubric").post(addRubricCriterion);
router.route("/:id/rubric/:criterionId").put(updateRubricCriterion).delete(deleteRubricCriterion);

module.exports = router;
