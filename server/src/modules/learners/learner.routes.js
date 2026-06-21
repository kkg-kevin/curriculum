const express = require("express");
const { createLearner, getAllLearners, getLearnerById, updateLearner, deleteLearner } = require("./learner.controller");

const router = express.Router();

router.route("/").get(getAllLearners).post(createLearner);
router.route("/:id").get(getLearnerById).put(updateLearner).delete(deleteLearner);

module.exports = router;
