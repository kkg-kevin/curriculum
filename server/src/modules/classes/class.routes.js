const express = require("express");
const {
  createClass, getAllClasses, getClassById, updateClass, deleteClass, bulkCreateClasses,
  getClassCourseTeachers, assignCourseTeacher, unassignCourseTeacher, setPrimaryCourseTeacher,
  getCourseTeacherLinksForTeacher,
} = require("./class.controller");
const { authorize } = require("../../shared/middleware/auth.middleware");

const router = express.Router();

// "school" manages classes within its own school only; "branchAdmin" manages classes across
// every hub in its branch (same shape, wider set — enforced server-side). "teacher" only reads
// classes it has at least one course-educator link in (dashboard finds "my classes" via the new
// teacherId filter, resolved server-side through class-course-teacher-link.model.js — verified
// again on the by-id route). "learner" only reads its own class.
router.route("/bulk").post(authorize("admin", "school", "branchAdmin"), bulkCreateClasses);
// Literal path — must be registered ahead of "/:id" below, otherwise Express would match
// "course-teacher-links" as the :id param and this route would never be reached.
router.route("/course-teacher-links").get(authorize("admin", "school", "teacher", "branchAdmin"), getCourseTeacherLinksForTeacher);
router.route("/")
  .get(authorize("admin", "school", "teacher", "branchAdmin"), getAllClasses)
  .post(authorize("admin", "school", "branchAdmin"), createClass);
router.route("/:id")
  .get(authorize("admin", "school", "teacher", "learner", "branchAdmin"), getClassById)
  .put(authorize("admin", "school", "branchAdmin"), updateClass)
  .delete(authorize("admin", "school", "branchAdmin"), deleteClass);

// Course-educator assignment — per (class, course) pair, multiple co-equal educators allowed.
// Reads are open to anyone who can already read the class; writes stay admin/school/branchAdmin,
// same posture as the old classTeacherId assignment.
router.route("/:id/course-teachers")
  .get(authorize("admin", "school", "teacher", "learner", "branchAdmin"), getClassCourseTeachers)
  .post(authorize("admin", "school", "branchAdmin"), assignCourseTeacher);
router.route("/:id/course-teachers/:courseId/:teacherId")
  .delete(authorize("admin", "school", "branchAdmin"), unassignCourseTeacher);
router.route("/:id/course-teachers/:courseId/:teacherId/primary")
  .patch(authorize("admin", "school", "branchAdmin"), setPrimaryCourseTeacher);

module.exports = router;
