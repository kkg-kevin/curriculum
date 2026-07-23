const express = require("express");
const {
  createTeacher,
  getAllTeachers,
  getTeacherById,
  updateTeacher,
  deleteTeacher,
  getTeacherHubs,
  linkTeacherHub,
  unlinkTeacherHub,
} = require("./teacher.controller");
const { authorize } = require("../../shared/middleware/auth.middleware");

const router = express.Router();

// "school" manages teachers within its own school only; "teacher" only ever reads its own
// record (both scoped server-side in the controller, never trusted from query/body).
router.route("/")
  .get(authorize("admin", "school", "teacher"), getAllTeachers)
  .post(authorize("admin", "school"), createTeacher);
// "teacher" may also PUT its own record — self-service profile editing — but the controller
// restricts what actually changes to contact fields only (see updateTeacher). True delete is
// admin-only — a "school" can only unlink a teacher from its own hub (see below), since the
// teacher may still be legitimately linked to a hub it doesn't own.
router.route("/:id")
  .get(authorize("admin", "school", "teacher"), getTeacherById)
  .put(authorize("admin", "school", "teacher"), updateTeacher)
  .delete(authorize("admin"), deleteTeacher);

// Which learning hubs a teacher is assigned to teach at — a many-to-many relationship, not a
// field on the teacher record. "teacher" may only read its own; "school" may read/write only
// its own hub's membership (enforced in the controller); "admin" is unrestricted.
router.route("/:id/hubs/links")
  .get(authorize("admin", "school", "teacher"), getTeacherHubs)
  .post(authorize("admin", "school"), linkTeacherHub);
router.route("/:id/hubs/links/:hubId")
  .delete(authorize("admin", "school"), unlinkTeacherHub);

module.exports = router;
