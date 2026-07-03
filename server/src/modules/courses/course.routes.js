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

router.route("/:id/sessions").get(getSessions).post(createSession);
router.route("/:id/sessions/bulk").post(createSessionsBulk);
router.route("/:id/sessions/:sessionId").put(updateSession).delete(deleteSession);

module.exports = router;
