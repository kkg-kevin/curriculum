const express = require("express");
const {
  createCourse,
  getAllCourses,
  getCourseById,
  updateCourse,
  deleteCourse,
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
} = require("./course.controller");

const router = express.Router();

router.route("/").get(getAllCourses).post(createCourse);
router.route("/:id").get(getCourseById).put(updateCourse).delete(deleteCourse);

// Competencies — this course's tagged competencies (authored globally under /api/competencies)
router.route("/:id/competencies/links").get(getCourseCompetencies).post(linkCompetency);
router.route("/:id/competencies/links/:competencyId").delete(unlinkCompetency);

// Learning Areas — this course's tagged learning areas (authored globally under /api/learning-areas)
router.route("/:id/learning-areas/links").get(getCourseLearningAreas).post(linkLearningArea);
router.route("/:id/learning-areas/links/:learningAreaId").delete(unlinkLearningArea);

// Curricula — read-only here; a course is added to a curriculum from the curriculum side
// (see curriculum.routes.js's /:id/courses/links), not from the course itself.
router.route("/:id/curricula/links").get(getCourseCurricula);

// Score Evidence — matches a course-attached assessment (via session.assessmentIds) to a linked
// curriculum's Evidence Type, previewing how its marks narrow down under that curriculum's scoring.
router.route("/:id/assessments/:assessmentId/scoring").get(getAssessmentScoring);

router.route("/:id/sessions").get(getSessions).post(createSession);
router.route("/:id/sessions/bulk").post(createSessionsBulk);
router.route("/:id/sessions/:sessionId").put(updateSession).delete(deleteSession);

module.exports = router;
