const express = require("express");
const asyncHandler = require("express-async-handler");
const AssessmentModel = require("./assessment.model");
const { assertOwn, isOwnedByAdmin } = require("../../shared/middleware/scope.middleware");
const {
  createAssessment,
  getAllAssessments,
  getAssessmentById,
  updateAssessment,
  deleteAssessment,
  getAssessmentCompetencies,
  linkCompetency,
  unlinkCompetency,
  getAssessmentPathways,
  linkPathway,
  unlinkPathway,
  getAssessmentInventory,
  linkInventoryItem,
  unlinkInventoryItem,
} = require("./assessment.controller");
const { authorize } = require("../../shared/middleware/auth.middleware");
const AssessmentFolderService = require("./assessment-folder.service");

const router = express.Router();

router.route("/").get(authorize("admin"), getAllAssessments).post(authorize("admin"), createAssessment);

// Assessment folders (Assessments page) — registered before "/:id" so "folders" is never read as an
// assessment id (or reaches the ownership check below).
const ok = (res, data, status = 200) => res.status(status).json({ success: true, data });
router.route("/folders")
  .get(authorize("admin"), asyncHandler(async (req, res) => ok(res, await AssessmentFolderService.list(req.ownerAdminId))))
  .post(authorize("admin"), asyncHandler(async (req, res) => ok(res, await AssessmentFolderService.create(req.ownerAdminId, req.body), 201)));
router.route("/folders/:folderId")
  .put(authorize("admin"), asyncHandler(async (req, res) => ok(res, await AssessmentFolderService.update(req.ownerAdminId, req.params.folderId, req.body))))
  .delete(authorize("admin"), asyncHandler(async (req, res) => ok(res, await AssessmentFolderService.remove(req.ownerAdminId, req.params.folderId))));
router.put("/folders/:folderId/assessments", authorize("admin"), asyncHandler(async (req, res) => ok(res, await AssessmentFolderService.addAssessments(req.ownerAdminId, req.params.folderId, req.body))));
router.delete("/folders/:folderId/assessments/:assessmentId", authorize("admin"), asyncHandler(async (req, res) => ok(res, await AssessmentFolderService.removeAssessment(req.ownerAdminId, req.params.folderId, req.params.assessmentId))));

router.route("/:id").get(authorize("admin"), getAssessmentById).put(authorize("admin"), updateAssessment).delete(authorize("admin"), deleteAssessment);

// Everything under "/:id/..." below is assessment-authoring content (competency/pathway/
// inventory links) — admin is the only role reaching writes here; the one shared GET
// (competencies/links, further down) is a plain name lookup open to school/teacher/learner too,
// so this can't gate on authorize("admin") itself (same reasoning as course.routes.js's
// equivalent mount). isOwnedByAdmin is a no-op (true) for non-admin roles.
router.use("/:id", asyncHandler(async (req, res, next) => {
  if (req.user.role === "admin") {
    assertOwn(isOwnedByAdmin(req, await AssessmentModel.findById(req.params.id)));
  }
  next();
}));

// Competencies — this assessment's tagged competencies (authored globally under /api/competencies).
// The read is also needed outside the builder: GradingPanel.jsx resolves indicator display names
// through it when a teacher/school grades a submission, and the learner-portal graded-assessment
// view resolves the same names for its own Competency Breakdown — plain name lookup, not
// ownership-sensitive, so it isn't admin-only like the rest of the builder's authoring routes.
router.get("/:id/competencies/links", authorize("admin", "school", "teacher", "learner"), getAssessmentCompetencies);
router.post("/:id/competencies/links", authorize("admin"), linkCompetency);
router.delete("/:id/competencies/links/:competencyId", authorize("admin"), unlinkCompetency);

// Pathways — this assessment's tagged pathways (authored globally under /api/pathway-templates)
router.route("/:id/pathways/links").get(authorize("admin"), getAssessmentPathways).post(authorize("admin"), linkPathway);
router.route("/:id/pathways/links/:pathwayId").delete(authorize("admin"), unlinkPathway);

// Inventory — this project's linked materials, each with a quantity (authored globally under /api/inventory)
router.route("/:id/inventory/links").get(authorize("admin"), getAssessmentInventory).post(authorize("admin"), linkInventoryItem);
router.route("/:id/inventory/links/:inventoryItemId").delete(authorize("admin"), unlinkInventoryItem);

module.exports = router;
