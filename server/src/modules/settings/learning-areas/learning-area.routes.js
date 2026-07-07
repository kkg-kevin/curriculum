const express = require("express");
const {
  getLearningAreas,
  createLearningArea,
  updateLearningArea,
  deleteLearningArea,
} = require("./learning-area.controller");

const router = express.Router();

router.route("/").get(getLearningAreas).post(createLearningArea);
router.route("/:aId").put(updateLearningArea).delete(deleteLearningArea);

module.exports = router;
