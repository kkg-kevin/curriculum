const express = require("express");
const {
  createLearningHub,
  getAllLearningHubs,
  getMyLearningHubs,
  getLearningHubById,
  updateLearningHub,
  deleteLearningHub,
  getHubTeachers,
} = require("./learning-hub.controller");
const { authorize } = require("../../shared/middleware/auth.middleware");

const router = express.Router();

// Must come before "/:id" below — otherwise Express would match "mine" as the :id param. A
// "school" account's own hub plus any branch hubs under it (see scope.middleware.js's
// req.ownSchools) — feeds the school-portal's hub-switcher.
router.route("/mine").get(authorize("school"), getMyLearningHubs);

// A "school"-type hub only ever sees its own (currently active) record — forced server-side, see
// getAllLearningHubs/getLearningHubById/isOwnHub. "teacher"/"learner" only need to read their own
// school's profile (e.g. to show its name on their dashboard) — never the full directory, so only
// the by-id route allows them. Non-school hub types (co-working space/innovation lab/makerspace/
// etc.) have no portal login yet, so this same admin+school role table simply doesn't apply to
// them in practice.
router.route("/")
  .get(authorize("admin", "school"), getAllLearningHubs)
  .post(authorize("admin"), createLearningHub);
router.route("/:id")
  .get(authorize("admin", "school", "teacher", "learner"), getLearningHubById)
  .put(authorize("admin", "school"), updateLearningHub)
  .delete(authorize("admin"), deleteLearningHub);

// Read-only mirror of the teacher-hub link table — write access lives on the teacher routes.
router.route("/:id/teachers/links")
  .get(authorize("admin", "school"), getHubTeachers);

module.exports = router;
