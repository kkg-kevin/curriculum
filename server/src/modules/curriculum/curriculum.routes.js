const express = require("express");
const {
  createCurriculum,
  getAllCurricula,
  getCurriculumById,
  updateCurriculum,
  deleteCurriculum,
} = require("./curriculum.controller");
const {
  getVersions,
  createVersion,
  editVersion,
  changeVersionStatus,
} = require("./curriculum-versions.controller");
const {
  getAcademicYears,
  createAcademicYear,
  editAcademicYear,
  changeStatus,
} = require("./academic-years.controller");

const router = express.Router();

router.route("/").get(getAllCurricula).post(createCurriculum);
router.route("/:id").get(getCurriculumById).put(updateCurriculum).delete(deleteCurriculum);

// Version Control routes
router.route("/:id/versions").get(getVersions).post(createVersion);
router.route("/:id/versions/:vId").put(editVersion);
router.route("/:id/versions/:vId/status").patch(changeVersionStatus);

// Academic year routes
router.route("/:id/academic-years").get(getAcademicYears).post(createAcademicYear);
router.route("/:id/academic-years/:yearId").put(editAcademicYear);
router.route("/:id/academic-years/:yearId/status").patch(changeStatus);

module.exports = router;
