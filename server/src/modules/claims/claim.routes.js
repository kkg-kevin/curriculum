const express = require("express");
const {
  getMyCourses, getMyCourse, submitClaim, withdrawClaim, listClaims,
  getClaim, supervisorDecision, adminDecision, markPaid, getSettings, updateSettings,
} = require("./claim.controller");
const { authorize } = require("../../shared/middleware/auth.middleware");

const router = express.Router();

// Educator claims. Three parties, two of them reviewers:
//   teacher  sees their own courses, submits a claim, can withdraw one nobody has reviewed yet.
//   admin    the workspace owner — and staff, whose role decides which stage they can act on:
//            "Educator claims" → Edit is the supervisor's review; "Claim approvals" → Edit is the
//            final approval, payment and rates (see access.registry.js's ACTION_OVERRIDES).
// Named routes are registered before "/:id" so they aren't read as a claim id.

router.get("/courses", authorize("teacher"), getMyCourses);
router.get("/courses/:classId/:courseId", authorize("teacher"), getMyCourse);

router.get("/settings", authorize("admin"), getSettings);
router.put("/settings", authorize("admin"), updateSettings);

router.get("/", authorize("teacher", "admin"), listClaims);
router.post("/", authorize("teacher"), submitClaim);

router.get("/:id", authorize("admin"), getClaim);
router.delete("/:id", authorize("teacher"), withdrawClaim);
router.post("/:id/supervisor-decision", authorize("admin"), supervisorDecision);
router.post("/:id/admin-decision", authorize("admin"), adminDecision);
router.post("/:id/mark-paid", authorize("admin"), markPaid);

module.exports = router;
