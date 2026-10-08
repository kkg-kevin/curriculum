const express = require("express");
const {
  listMyCertificates, getMyProgress, listCertificates, getCertificate, revokeCertificate, reinstateCertificate,
  getSettings, updateSettings,
} = require("./certificate.controller");
const { authorize } = require("../../shared/middleware/auth.middleware");

const router = express.Router();

// Certificates are never created or edited through the API — a course certificate is issued when
// a learner's final course report is published and revoked when it is withdrawn, and pathway and
// bootcamp certificates follow from those (see certificate.service.js). Staff can read them, and
// revoke or reinstate one by hand.

// Learner-facing: this learner's own certificates. Above "/:id" so "learner" isn't read as an id.
router.get("/learner/mine", authorize("learner"), listMyCertificates);
// What this learner can earn next, with how far along they are.
router.get("/learner/progress", authorize("learner"), getMyProgress);

// Staff-facing: one learner's (?learnerId=), a class's (?classId=&courseId=), or — admin and
// school — every certificate in the workspace / hub.
router.get("/", authorize("admin", "school", "teacher"), listCertificates);

router.get("/:id", authorize("admin", "school", "teacher", "learner"), getCertificate);
router.post("/:id/revoke", authorize("admin", "school"), revokeCertificate);
router.post("/:id/reinstate", authorize("admin", "school"), reinstateCertificate);

// Settings → Certificates: who signs the workspace's certificates. Mounted on its own path in
// app.js (owner only), like the workspace's email settings.
const settingsRouter = express.Router();
settingsRouter.route("/").get(getSettings).put(updateSettings);

module.exports = router;
module.exports.settingsRouter = settingsRouter;
