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

// "school" manages learners linked to its own hub only; "branchAdmin" manages learners across
// every hub in its branch (same shape, wider set — enforced server-side). "teacher" only reads
// rosters for classes it actually teaches. "learner" only reads its own record (matched via
// guardianEmail). True delete is admin-only — losing access to a learner shared with another
// hub must unenroll (see /:id/hubs/links/:hubId below), never destroy the record.
router.route("/")
  .get(authorize("admin", "school", "teacher", "learner", "branchAdmin"), getAllLearners)
  .post(authorize("admin", "school", "branchAdmin"), createLearner);
router.route("/:id")
  .get(authorize("admin", "school", "teacher", "learner", "branchAdmin"), getLearnerById)
  .put(authorize("admin", "school", "learner", "branchAdmin"), updateLearner)
  .delete(authorize("admin"), deleteLearner);

// Which learning hub(s) a learner is enrolled at — a many-to-many relationship, not a field on
// the learner record. "teacher"/"learner" may only read (their own classes / their own
// record); "school"/"branchAdmin" may read/write only hub(s) they own (enforced in the
// controller); "admin" is unrestricted.
router.route("/:id/hubs/links")
  .get(authorize("admin", "school", "teacher", "learner", "branchAdmin"), getLearnerHubs)
  .post(authorize("admin", "school", "branchAdmin"), enrollLearnerHub);
router.route("/:id/hubs/links/:hubId")
  .put(authorize("admin", "school", "branchAdmin"), updateLearnerHubLink)
  .delete(authorize("admin", "school", "branchAdmin"), unenrollLearnerHub);

module.exports = router;
