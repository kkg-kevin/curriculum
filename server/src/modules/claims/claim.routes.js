const express = require("express");
const {
  getMyCourses, getMyCourse, submitClaim, withdrawClaim, listClaims,
  getClaim, supervisorDecision, adminDecision, markPaid, getSettings, updateSettings,
  listSupervisors, createSupervisor, updateSupervisor, removeSupervisor,
} = require("./claim.controller");
const { authorize } = require("../../shared/middleware/auth.middleware");

const router = express.Router();

// Educator claims. Three parties:
//   teacher     sees their own courses, submits a claim, can withdraw one nobody has reviewed yet.
//   supervisor  an account that only reviews claims — it sees the claims of the educators
//               assigned to it and approves or declines them.
//   admin       the workspace owner — and staff, by role: "Claim approvals" → Edit is approving a
//               claim that has no supervisor, paying, the rates and the supervisor accounts;
//               "Educator claims" → Edit is deciding in a supervisor's place (see
//               access.registry.js's ACTION_OVERRIDES).
// Named routes are registered before "/:id" so they aren't read as a claim id.

router.get("/courses", authorize("teacher"), getMyCourses);
router.get("/courses/:classId/:courseId", authorize("teacher"), getMyCourse);

router.get("/settings", authorize("admin"), getSettings);
router.put("/settings", authorize("admin"), updateSettings);

router.get("/supervisors", authorize("admin"), listSupervisors);
router.post("/supervisors", authorize("admin"), createSupervisor);
router.put("/supervisors/:id", authorize("admin"), updateSupervisor);
router.delete("/supervisors/:id", authorize("admin"), removeSupervisor);

router.get("/", authorize("teacher", "supervisor", "admin"), listClaims);
router.post("/", authorize("teacher"), submitClaim);

router.get("/:id", authorize("supervisor", "admin"), getClaim);
router.delete("/:id", authorize("teacher"), withdrawClaim);
router.post("/:id/supervisor-decision", authorize("supervisor", "admin"), supervisorDecision);
router.post("/:id/admin-decision", authorize("admin"), adminDecision);
router.post("/:id/mark-paid", authorize("admin"), markPaid);

module.exports = router;
