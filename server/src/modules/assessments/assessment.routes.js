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
const { authorize } = require("../../shared/middleware/auth.middleware");

const router = express.Router();

router.route("/").get(authorize("admin"), getAllAssessments).post(authorize("admin"), createAssessment);
router.route("/:id").get(authorize("admin"), getAssessmentById).put(authorize("admin"), updateAssessment).delete(authorize("admin"), deleteAssessment);

// Competencies — this assessment's tagged competencies (authored globally under /api/competencies).
// The read is also needed outside the builder: GradingPanel.jsx resolves indicator display names
// through it when a teacher/school grades a submission, so it isn't admin-only like the rest of
// the builder's authoring routes.
router.get("/:id/competencies/links", authorize("admin", "school", "teacher"), getAssessmentCompetencies);
router.post("/:id/competencies/links", authorize("admin"), linkCompetency);
router.delete("/:id/competencies/links/:competencyId", authorize("admin"), unlinkCompetency);

// Learning Areas — this assessment's tagged learning areas (authored globally under /api/learning-areas)
router.route("/:id/learning-areas/links").get(authorize("admin"), getAssessmentLearningAreas).post(authorize("admin"), linkLearningArea);
router.route("/:id/learning-areas/links/:learningAreaId").delete(authorize("admin"), unlinkLearningArea);

// Inventory — this project's linked materials, each with a quantity (authored globally under /api/inventory)
router.route("/:id/inventory/links").get(authorize("admin"), getAssessmentInventory).post(authorize("admin"), linkInventoryItem);
router.route("/:id/inventory/links/:inventoryItemId").delete(authorize("admin"), unlinkInventoryItem);

module.exports = router;
