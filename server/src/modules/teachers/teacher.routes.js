const express = require("express");
const {
  createTeacher,
  getAllTeachers,
  getTeacherById,
  updateTeacher,
  deleteTeacher,
} = require("./teacher.controller");

const router = express.Router();

router.route("/").get(getAllTeachers).post(createTeacher);
router.route("/:id").get(getTeacherById).put(updateTeacher).delete(deleteTeacher);

module.exports = router;
