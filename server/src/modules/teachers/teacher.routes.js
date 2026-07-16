const express = require("express");
const {
  createTeacher,
  getAllTeachers,
  getTeacherById,
  updateTeacher,
  deleteTeacher,
} = require("./teacher.controller");
const { authorize } = require("../../shared/middleware/auth.middleware");

const router = express.Router();

// "school" manages teachers within its own school only; "teacher" only ever reads its own
// record (both scoped server-side in the controller, never trusted from query/body).
router.route("/")
  .get(authorize("admin", "school", "teacher"), getAllTeachers)
  .post(authorize("admin", "school"), createTeacher);
// "teacher" may also PUT its own record — self-service profile editing — but the controller
// restricts what actually changes to contact fields only (see updateTeacher).
router.route("/:id")
  .get(authorize("admin", "school", "teacher"), getTeacherById)
  .put(authorize("admin", "school", "teacher"), updateTeacher)
  .delete(authorize("admin", "school"), deleteTeacher);

module.exports = router;
