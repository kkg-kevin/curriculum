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
  getCourseLearningAreas,
  linkLearningArea,
  unlinkLearningArea,
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
// Learning Journey card resolves course names for a learner's placement options from it.
router.route("/").get(authorize("admin", "school"), getAllCourses).post(authorize("admin"), createCourse);
router.route("/:id")
  .get(authorize("admin", "teacher", "learner", "school"), getCourseById)
  .put(authorize("admin"), updateCourse)
  .delete(authorize("admin"), deleteCourse);
router.route("/:id/duplicate").post(authorize("admin"), duplicateCourse);

// Competencies — this course's tagged competencies (authored globally under /api/competencies)
router.route("/:id/competencies/links").get(authorize("admin"), getCourseCompetencies).post(authorize("admin"), linkCompetency);
router.route("/:id/competencies/links/:competencyId").delete(authorize("admin"), unlinkCompetency);

// Learning Areas — this course's tagged learning areas (authored globally under /api/learning-areas)
router.route("/:id/learning-areas/links").get(authorize("admin"), getCourseLearningAreas).post(authorize("admin"), linkLearningArea);
router.route("/:id/learning-areas/links/:learningAreaId").delete(authorize("admin"), unlinkLearningArea);

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
