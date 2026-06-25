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
  createGroup,
  createVersion: createAYVersion,
  changeStatus,
} = require("./academic-years.controller");
const {
  getLearningAreas,
  createLearningArea,
  updateLearningArea,
  deleteLearningArea,
  getCompetencies,
  createCompetency,
  updateCompetency,
  deleteCompetency,
  getLadder,
  updateLadder,
} = require("../competencies/competency.controller");

const router = express.Router();

// Curriculum CRUD
router.route("/").get(getAllCurricula).post(createCurriculum);
router.route("/:id").get(getCurriculumById).put(updateCurriculum).delete(deleteCurriculum);

// Curriculum version control
router.route("/:id/versions").get(getVersions).post(createVersion);
router.route("/:id/versions/:vId").put(editVersion);
router.route("/:id/versions/:vId/status").patch(changeVersionStatus);

// Academic years — two-level hierarchy (groups → versions)
router.route("/:id/academic-years").get(getAcademicYears).post(createGroup);
router.route("/:id/academic-years/:groupId/versions").post(createAYVersion);
router.route("/:id/academic-years/:groupId/versions/:versionId/status").patch(changeStatus);

// Competencies — learning areas
router.route("/:id/competencies/learning-areas").get(getLearningAreas).post(createLearningArea);
router.route("/:id/competencies/learning-areas/:aId").put(updateLearningArea).delete(deleteLearningArea);

// Competencies — competency items
router.route("/:id/competencies/items").get(getCompetencies).post(createCompetency);
router.route("/:id/competencies/items/:cId").put(updateCompetency).delete(deleteCompetency);

// Competencies — progression ladder
router.route("/:id/competencies/ladder").get(getLadder).put(updateLadder);

module.exports = router;
