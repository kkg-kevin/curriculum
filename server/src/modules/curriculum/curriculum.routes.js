const express = require("express");
const {
  createCurriculum,
  getAllCurricula,
  getCurriculumById,
  updateCurriculum,
  deleteCurriculum,
  updateCurriculumStructure,
} = require("./curriculum.controller");
const {
  getAllVersions,
  getVersionById,
  createVersion,
  publishVersion,
  revertVersion,
} = require("./curriculum-versions.controller");

const router = express.Router();

router.route("/").get(getAllCurricula).post(createCurriculum);
router.route("/:id").get(getCurriculumById).put(updateCurriculum).delete(deleteCurriculum);
router.route("/:id/structure").put(updateCurriculumStructure);

// Version routes
router.route("/:id/versions").get(getAllVersions).post(createVersion);
router.route("/:id/versions/:vId").get(getVersionById);
router.route("/:id/versions/:vId/publish").post(publishVersion);
router.route("/:id/versions/:vId/revert").post(revertVersion);

module.exports = router;
