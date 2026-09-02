const express = require("express");
const {
  createClass, getAllClasses, getClassById, updateClass, deleteClass, bulkCreateClasses,
  getClassCourseTeachers, assignCourseTeacher, unassignCourseTeacher, setPrimaryCourseTeacher,
  getCourseTeacherLinksForTeacher, getPromotionReadiness, promoteLearners,
  getCompletionStatus, markSessionNotSubmitted,
} = require("./class.controller");
const { authorize } = require("../../shared/middleware/auth.middleware");

const router = express.Router();

// "school" manages classes within its own (currently active) hub only — a hub that's itself the
// parent of branch hubs can switch which one is active, see scope.middleware.js. "teacher" only
// reads classes it has at least one course-educator link in (dashboard finds "my classes" via
// the new teacherId filter, resolved server-side through class-course-teacher-link.model.js —
// verified again on the by-id route). "learner" only reads its own class.
router.route("/bulk").post(authorize("admin", "school"), bulkCreateClasses);
// Literal path — must be registered ahead of "/:id" below, otherwise Express would match
// "course-teacher-links" as the :id param and this route would never be reached.
router.route("/course-teacher-links").get(authorize("admin", "school", "teacher"), getCourseTeacherLinksForTeacher);
router.route("/")
  .get(authorize("admin", "school", "teacher"), getAllClasses)
  .post(authorize("admin", "school"), createClass);
router.route("/:id")
  .get(authorize("admin", "school", "teacher", "learner"), getClassById)
  .put(authorize("admin", "school"), updateClass)
  .delete(authorize("admin", "school"), deleteClass);

// Course-educator assignment — per (class, course) pair, multiple co-equal educators allowed.
// Reads are open to anyone who can already read the class; writes stay admin/school, same
// posture as the old classTeacherId assignment.
router.route("/:id/course-teachers")
  .get(authorize("admin", "school", "teacher", "learner"), getClassCourseTeachers)
  .post(authorize("admin", "school"), assignCourseTeacher);
router.route("/:id/course-teachers/:courseId/:teacherId")
  .delete(authorize("admin", "school"), unassignCourseTeacher);
router.route("/:id/course-teachers/:courseId/:teacherId/primary")
  .patch(authorize("admin", "school"), setPrimaryCourseTeacher);

// Grade-completion readiness + promotion into the next grade's class — same read/write posture
// as course-teachers above (reads open to teacher too, writes admin/school only).
router.route("/:id/promotion-readiness")
  .get(authorize("admin", "school", "teacher"), getPromotionReadiness);
router.route("/:id/promote-learners")
  .post(authorize("admin", "school"), promoteLearners);

// Year-completion checklist (sessions taught / grading / attendance closed / reports filed) and
// the one write it needs that isn't grading — filing a not-submitted session report. Reads open
// to teacher; the write is teacher-capable too (it's a grading-adjacent action).
router.route("/:id/completion-status")
  .get(authorize("admin", "school", "teacher"), getCompletionStatus);
router.route("/:id/mark-not-submitted")
  .post(authorize("admin", "school", "teacher"), markSessionNotSubmitted);

module.exports = router;
