const express = require("express");
const {
  createSchool,
  getAllSchools,
  getSchoolById,
  updateSchool,
  deleteSchool,
} = require("./school.controller");

const router = express.Router();

router.route("/").get(getAllSchools).post(createSchool);
router.route("/:id").get(getSchoolById).put(updateSchool).delete(deleteSchool);

module.exports = router;
