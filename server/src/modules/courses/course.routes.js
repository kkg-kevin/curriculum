const express = require("express");
const {
  createCourse,
  getAllCourses,
  getCourseById,
  updateCourse,
  deleteCourse,
  duplicateCourse,
  getCourseCompetencies,
  linkCompetency,
  unlinkCompetency,
  getCoursePathways,
  linkPathway,
  unlinkPathway,
  getCourseInventory,
  linkInventoryItem,
  unlinkInventoryItem,
  getCourseCurricula,
  getAssessmentScoring,
  getSessions,
  createSession,
  createSessionsBulk,
  updateSession,
  deleteSession,
  getModules,
  createModule,
  updateModule,
  deleteModule,
} = require("./course.controller");
const { authorize } = require("../../shared/middleware/auth.middleware");

const router = express.Router();

// Course authoring (builder pages, links, sessions, modules) is admin-only. Teacher/learner/
// school portals only ever open a specific course they already know the id of (reached via the
// curriculum's current-courses list) to read its content — never the bare catalog list, which
// spans every school's curriculum. "school" does need the bare list too — LearnerViewPage's
// Pathway card resolves course names for a learner's placement options from it.
// getCourseById/getSessions/getModules additionally verify ownership via assertCourseAccess
// (course.controller.js) — a course is reusable across curricula, so the role check alone isn't
// enough; it traces back through the caller's own hub/class to confirm the course is actually
// reachable from a curriculum they belong to.
router.route("/").get(authorize("admin", "school"), getAllCourses).post(authorize("admin"), createCourse);
router.route("/:id")
  .get(authorize("admin", "teacher", "learner", "school"), getCourseById)
  .put(authorize("admin"), updateCourse)
  .delete(authorize("admin"), deleteCourse);
router.route("/:id/duplicate").post(authorize("admin"), duplicateCourse);

// Competencies — this course's tagged competencies (authored globally under /api/competencies)
router.route("/:id/competencies/links").get(authorize("admin"), getCourseCompetencies).post(authorize("admin"), linkCompetency);
router.route("/:id/competencies/links/:competencyId").delete(authorize("admin"), unlinkCompetency);

// Pathways — this course's tagged pathways (authored globally under /api/pathway-templates)
router.route("/:id/pathways/links").get(authorize("admin"), getCoursePathways).post(authorize("admin"), linkPathway);
router.route("/:id/pathways/links/:pathwayId").delete(authorize("admin"), unlinkPathway);

// Inventory — this course's linked materials, each with a quantity (authored globally under
// /api/inventory), same shape/authoring posture as a Project assessment's own inventory links.
router.route("/:id/inventory/links").get(authorize("admin"), getCourseInventory).post(authorize("admin"), linkInventoryItem);
router.route("/:id/inventory/links/:inventoryItemId").delete(authorize("admin"), unlinkInventoryItem);

// Curricula — read-only here; a course is added to a curriculum from the curriculum side
// (see curriculum.routes.js's /:id/courses/links), not from the course itself.
router.route("/:id/curricula/links").get(authorize("admin"), getCourseCurricula);

// Score Evidence — matches a course-attached assessment (via session.assessmentIds or
// assessmentAttachments) to a linked
// curriculum's Evidence Type, previewing how its marks narrow down under that curriculum's scoring.
router.route("/:id/assessments/:assessmentId/scoring").get(authorize("admin"), getAssessmentScoring);

router.route("/:id/sessions").get(authorize("admin", "teacher", "learner", "school"), getSessions).post(authorize("admin"), createSession);
router.route("/:id/sessions/bulk").post(authorize("admin"), createSessionsBulk);
router.route("/:id/sessions/:sessionId").put(authorize("admin"), updateSession).delete(authorize("admin"), deleteSession);

// Modules — group this course's Sessions under a named bucket (e.g. "Module 1" of 3).
// Deleting a module un-assigns its sessions (moduleId -> null) rather than deleting them.
router.route("/:id/modules").get(authorize("admin", "teacher", "learner", "school"), getModules).post(authorize("admin"), createModule);
router.route("/:id/modules/:moduleId").put(authorize("admin"), updateModule).delete(authorize("admin"), deleteModule);

module.exports = router;
