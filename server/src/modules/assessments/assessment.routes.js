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
  getAssessmentLearningAreas,
  linkLearningArea,
  unlinkLearningArea,
  getAssessmentInventory,
  linkInventoryItem,
  unlinkInventoryItem,
} = require("./assessment.controller");

const router = express.Router();

router.route("/").get(getAllAssessments).post(createAssessment);
router.route("/:id").get(getAssessmentById).put(updateAssessment).delete(deleteAssessment);

// Competencies — this assessment's tagged competencies (authored globally under /api/competencies)
router.route("/:id/competencies/links").get(getAssessmentCompetencies).post(linkCompetency);
router.route("/:id/competencies/links/:competencyId").delete(unlinkCompetency);

// Learning Areas — this assessment's tagged learning areas (authored globally under /api/learning-areas)
router.route("/:id/learning-areas/links").get(getAssessmentLearningAreas).post(linkLearningArea);
router.route("/:id/learning-areas/links/:learningAreaId").delete(unlinkLearningArea);

// Inventory — this project's linked materials, each with a quantity (authored globally under /api/inventory)
router.route("/:id/inventory/links").get(getAssessmentInventory).post(linkInventoryItem);
router.route("/:id/inventory/links/:inventoryItemId").delete(unlinkInventoryItem);

module.exports = router;
