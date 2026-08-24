const express = require("express");
const {
  createLearner,
  bulkImportLearners,
  getAllLearners,
  getLearnerById,
  updateLearner,
  updateLearnerAccountStatus,
  deleteLearner,
  getLearnerHubs,
  enrollLearnerHub,
  updateLearnerHubLink,
  unenrollLearnerHub,
  transferLearnerHub,
  ensureDiagnosticsIssued,
  completeHubOnboarding,
  getPublicToken,
  regeneratePublicToken,
} = require("./learner.controller");
const { authorize } = require("../../shared/middleware/auth.middleware");

const router = express.Router();

// "school" manages learners linked to its own (currently active) hub only — enforced
// server-side. "teacher" only reads rosters for classes it actually teaches. "learner" only
// reads its own record (matched via guardianEmail). True delete is admin-only — losing access to
// a learner shared with another hub must unenroll (see /:id/hubs/links/:hubId below), never
// destroy the record.
router.route("/")
  .get(authorize("admin", "school", "teacher", "learner"), getAllLearners)
  .post(authorize("admin", "school"), createLearner);

// Bulk onboarding from a spreadsheet — must stay ahead of "/:id" below, since Express would
// otherwise match "bulk-import" as an :id on any verb the param route also defines (see
// class.routes.js and others for the same static-before-param ordering rule).
router.post("/bulk-import", authorize("admin", "school"), bulkImportLearners);

router.route("/:id")
  .get(authorize("admin", "school", "teacher", "learner"), getLearnerById)
  .put(authorize("admin", "school", "learner"), updateLearner)
  .delete(authorize("admin"), deleteLearner);

router.patch("/:id/account-status", authorize("admin"), updateLearnerAccountStatus);

// Which learning hub(s) a learner is enrolled at — a many-to-many relationship, not a field on
// the learner record. "teacher"/"learner" may only read (their own classes / their own
// record); "school" may read/write only hub(s) they own (enforced in the controller); "admin" is
// unrestricted.
router.route("/:id/hubs/links")
  .get(authorize("admin", "school", "teacher", "learner"), getLearnerHubs)
  .post(authorize("admin", "school"), enrollLearnerHub);
router.route("/:id/hubs/links/:hubId")
  .put(authorize("admin", "school"), updateLearnerHubLink)
  .delete(authorize("admin", "school"), unenrollLearnerHub);

// Moves a learner from :hubId to another hub in one action (enroll-at-new + unlink-old) — see
// transferHub's comment in the service for why this isn't just a status flip.
router.route("/:id/hubs/links/:hubId/transfer")
  .post(authorize("admin", "school"), transferLearnerHub);

// Learner-portal-only safety net — see ensureDiagnosticsIssued's comment in the controller.
router.post("/:id/ensure-diagnostics", authorize("learner"), ensureDiagnosticsIssued);

// Learner-portal-only — see completeHubOnboarding's comment in the controller.
router.post("/:id/hubs/:hubId/complete-onboarding", authorize("learner"), completeHubOnboarding);

// "Share via QR" token — mint/rotate only, same ownership scoping as PUT /:id above, plus
// "learner" (guardian-mediated or the learner's own dedicated login) so the learner-portal's own
// Profile page can show/regenerate its own QR without needing a staff member to do it — scoped
// to self-only in the controller. The unauthenticated read side (GET by token, not by :id) lives
// on its own public router — see public-profile.routes.js — since it must never sit behind this
// file's `protect` middleware.
router.post("/:id/public-token", authorize("admin", "school", "learner"), getPublicToken);
router.post("/:id/public-token/regenerate", authorize("admin", "school", "learner"), regeneratePublicToken);

module.exports = router;
