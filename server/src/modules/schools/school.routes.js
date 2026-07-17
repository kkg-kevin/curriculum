const express = require("express");
const {
  createSchool,
  getAllSchools,
  getSchoolById,
  updateSchool,
  deleteSchool,
} = require("./school.controller");
const { authorize } = require("../../shared/middleware/auth.middleware");

const router = express.Router();

// "school" only ever sees its own record (getAllSchools/getSchoolById force that server-side);
// "teacher"/"learner" only need to read their own school's profile (e.g. to show its name on
// their dashboard) — never the full directory, so only the by-id route allows them.
router.route("/")
  .get(authorize("admin", "school"), getAllSchools)
  .post(authorize("admin"), createSchool);
router.route("/:id")
  .get(authorize("admin", "school", "teacher", "learner"), getSchoolById)
  .put(authorize("admin", "school"), updateSchool)
  .delete(authorize("admin"), deleteSchool);

module.exports = router;
