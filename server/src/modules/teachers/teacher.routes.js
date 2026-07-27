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

// "school" manages teachers within its own school only; "branchAdmin" manages teachers across
// every hub in its branch (same shape, wider set — enforced server-side in the controller via
// isOwnHub/isLinkedToOwnHub); "teacher" only ever reads its own record.
router.route("/")
  .get(authorize("admin", "school", "teacher", "branchAdmin"), getAllTeachers)
  .post(authorize("admin", "school", "branchAdmin"), createTeacher);
// "teacher" may also PUT its own record — self-service profile editing — but the controller
// restricts what actually changes to contact fields only (see updateTeacher). True delete is
// admin-only — a "school"/"branchAdmin" can only unlink a teacher from a hub (see below), since
// the teacher may still be legitimately linked to a hub it doesn't own. "learner" may also
// read — scoped in the controller to only its own class teacher, for the learner-portal profile.
router.route("/:id")
  .get(authorize("admin", "school", "teacher", "learner", "branchAdmin"), getTeacherById)
  .put(authorize("admin", "school", "teacher", "branchAdmin"), updateTeacher)
  .delete(authorize("admin"), deleteTeacher);

// Which learning hubs a teacher is assigned to teach at — a many-to-many relationship, not a
// field on the teacher record. "teacher" may only read its own; "school"/"branchAdmin" may
// read/write only hub(s) they own (enforced in the controller); "admin" is unrestricted.
router.route("/:id/hubs/links")
  .get(authorize("admin", "school", "teacher", "branchAdmin"), getTeacherHubs)
  .post(authorize("admin", "school", "branchAdmin"), linkTeacherHub);
router.route("/:id/hubs/links/:hubId")
  .delete(authorize("admin", "school", "branchAdmin"), unlinkTeacherHub);

module.exports = router;
