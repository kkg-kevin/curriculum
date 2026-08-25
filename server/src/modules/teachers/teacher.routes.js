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
  getTeacherAvailability,
  addTeacherAvailabilitySlot,
  updateTeacherAvailabilitySlot,
  deleteTeacherAvailabilitySlot,
} = require("./teacher.controller");
const { authorize } = require("../../shared/middleware/auth.middleware");

const router = express.Router();

// "school" manages teachers within its own (currently active) hub only — enforced server-side in
// the controller via isOwnHub/isLinkedToOwnHub; "teacher" only ever reads its own record.
router.route("/")
  .get(authorize("admin", "school", "teacher"), getAllTeachers)
  .post(authorize("admin", "school"), createTeacher);
// "teacher" may also PUT its own record — self-service profile editing — but the controller
// restricts what actually changes to contact fields only (see updateTeacher). True delete is
// admin-only — a "school" can only unlink a teacher from a hub (see below), since the teacher
// may still be legitimately linked to a hub it doesn't own. "learner" may also read — scoped in
// the controller to only its own class teacher, for the learner-portal profile.
router.route("/:id")
  .get(authorize("admin", "school", "teacher", "learner"), getTeacherById)
  .put(authorize("admin", "school", "teacher"), updateTeacher)
  .delete(authorize("admin"), deleteTeacher);

// Which learning hubs a teacher is assigned to teach at — a many-to-many relationship, not a
// field on the teacher record. "teacher" may only read its own; "school" may read/write only
// hub(s) they own (enforced in the controller); "admin" is unrestricted.
router.route("/:id/hubs/links")
  .get(authorize("admin", "school", "teacher"), getTeacherHubs)
  .post(authorize("admin", "school"), linkTeacherHub);
router.route("/:id/hubs/links/:hubId")
  .delete(authorize("admin", "school"), unlinkTeacherHub);

// A teacher's own weekly "here's when I can teach" windows — read is open to "school" too (not
// just admin/self) so a school can check availability before assigning a teacher to a timetable
// slot; write is teacher-self or admin/school-of-record, enforced in the controller. Purely
// opt-in data — see timetable.service.js's hasConflict for how (or whether) it's enforced.
router.route("/:id/availability")
  .get(authorize("admin", "school", "teacher"), getTeacherAvailability)
  .post(authorize("admin", "school", "teacher"), addTeacherAvailabilitySlot);
router.route("/:id/availability/:slotId")
  .put(authorize("admin", "school", "teacher"), updateTeacherAvailabilitySlot)
  .delete(authorize("admin", "school", "teacher"), deleteTeacherAvailabilitySlot);

module.exports = router;
