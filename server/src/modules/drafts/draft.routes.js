const express = require("express");
const { draftController } = require("./draft.controller");

// A drafts router serving the given kinds. Mounted under the module whose forms they are —
// /api/assessments/drafts (assessment) and /api/courses/drafts (course, course-session) — so the
// staff permission for that module covers its drafts, and ahead of that module's own router
// (whose "/:id" would otherwise take "drafts" for a record id). Behind protect + attachOwnRecords
// + authorize("admin"); every draft is scoped to req.ownerAdminId in the service. See app.js.
function draftRouter(kinds) {
  const { listDrafts, getDraft, createDraft, updateDraft, deleteDraft } = draftController(kinds);
  const router = express.Router();
  router.route("/").get(listDrafts).post(createDraft);
  router.route("/:id").get(getDraft).put(updateDraft).delete(deleteDraft);
  return router;
}

module.exports = { draftRouter };
