const express = require("express");
const { createLearner, getAllLearners, getLearnerById, updateLearner, deleteLearner } = require("./learner.controller");
const { authorize } = require("../../shared/middleware/auth.middleware");

const router = express.Router();

// "school" manages learners within its own school only. "teacher" only reads rosters for
// classes it actually teaches. "learner" only reads its own record (matched via guardianEmail).
router.route("/")
  .get(authorize("admin", "school", "teacher", "learner"), getAllLearners)
  .post(authorize("admin", "school"), createLearner);
router.route("/:id")
  .get(authorize("admin", "school", "teacher", "learner"), getLearnerById)
  .put(authorize("admin", "school"), updateLearner)
  .delete(authorize("admin", "school"), deleteLearner);

module.exports = router;
