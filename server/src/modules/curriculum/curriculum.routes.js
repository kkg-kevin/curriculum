const express = require("express");
const {
  createCurriculum,
  getAllCurricula,
  getCurriculumById,
  updateCurriculum,
  deleteCurriculum,
  updateCurriculumStructure,
} = require("./curriculum.controller");

const router = express.Router();

router.route("/").get(getAllCurricula).post(createCurriculum);
router.route("/:id").get(getCurriculumById).put(updateCurriculum).delete(deleteCurriculum);
router.route("/:id/structure").put(updateCurriculumStructure);

module.exports = router;
