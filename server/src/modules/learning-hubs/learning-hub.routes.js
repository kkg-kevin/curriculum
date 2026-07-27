const express = require("express");
const {
  createLearningHub,
  getAllLearningHubs,
  getLearningHubById,
  updateLearningHub,
  deleteLearningHub,
  getHubTeachers,
} = require("./learning-hub.controller");
const { authorize } = require("../../shared/middleware/auth.middleware");

const router = express.Router();

// A "school"-type hub only ever sees its own record, and a "branchAdmin" only ever sees every
// hub under their branch (both forced server-side — see getAllLearningHubs/getLearningHubById/
// isOwnHub); "teacher"/"learner" only need to read their own school's profile (e.g. to show its
// name on their dashboard) — never the full directory, so only the by-id route allows them.
// Non-school hub types (co-working space/innovation lab/makerspace/etc.) have no portal login
// yet, so this same admin+school+branchAdmin role table simply doesn't apply to them in
// practice. True delete stays admin-only — a branchAdmin manages a hub's content, not whether
// the record exists at all, same boundary as "school" always had.
router.route("/")
  .get(authorize("admin", "school", "branchAdmin"), getAllLearningHubs)
  .post(authorize("admin", "branchAdmin"), createLearningHub);
router.route("/:id")
  .get(authorize("admin", "school", "teacher", "learner", "branchAdmin"), getLearningHubById)
  .put(authorize("admin", "school", "branchAdmin"), updateLearningHub)
  .delete(authorize("admin"), deleteLearningHub);

// Read-only mirror of the teacher-hub link table — write access lives on the teacher routes.
router.route("/:id/teachers/links")
  .get(authorize("admin", "school", "branchAdmin"), getHubTeachers);

module.exports = router;
