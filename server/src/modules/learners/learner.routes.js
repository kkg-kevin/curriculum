const express = require("express");
const {
  createLearner,
  getAllLearners,
  getLearnerById,
  updateLearner,
  deleteLearner,
  getLearnerHubs,
  enrollLearnerHub,
  updateLearnerHubLink,
  unenrollLearnerHub,
} = require("./learner.controller");
const { authorize } = require("../../shared/middleware/auth.middleware");

const router = express.Router();

// "school" manages learners linked to its own hub only. "teacher" only reads rosters for
// classes it actually teaches. "learner" only reads its own record (matched via guardianEmail).
// True delete is admin-only — a "school" losing access to a learner shared with another hub
// must unenroll (see /:id/hubs/links/:hubId below), never destroy the underlying record.
router.route("/")
  .get(authorize("admin", "school", "teacher", "learner"), getAllLearners)
  .post(authorize("admin", "school"), createLearner);
router.route("/:id")
  .get(authorize("admin", "school", "teacher", "learner"), getLearnerById)
  .put(authorize("admin", "school", "learner"), updateLearner)
  .delete(authorize("admin"), deleteLearner);

// Which learning hub(s) a learner is enrolled at — a many-to-many relationship, not a field on
// the learner record. "teacher"/"learner" may only read (their own classes / their own
// record); "school" may read/write only its own hub's membership (enforced in the
// controller); "admin" is unrestricted.
router.route("/:id/hubs/links")
  .get(authorize("admin", "school", "teacher", "learner"), getLearnerHubs)
  .post(authorize("admin", "school"), enrollLearnerHub);
router.route("/:id/hubs/links/:hubId")
  .put(authorize("admin", "school"), updateLearnerHubLink)
  .delete(authorize("admin", "school"), unenrollLearnerHub);

module.exports = router;
