const express = require("express");
const {
  logVisit, listVisits, getVisit, updateVisit, deleteVisit, previewGenerateCharges, generateCharges, getHubRevenueSummary, getAllHubsRevenueSummary,
} = require("./hub-visit.controller");
const { authorize } = require("../../shared/middleware/auth.middleware");

const router = express.Router();

// No "learner" role anywhere here - a learner never logs or manages visits; their charges
// surface exclusively through the existing /api/billing routes (the hub_usage invoice this
// module generates), which is the whole point of reusing Billing instead of a parallel ledger.

// Registered before "/:id" - a single-segment GET route further down would otherwise swallow
// these, same reason billing.routes.js registers "/batches"/"/customers" before "/:id".
router.get("/revenue-summary", authorize("admin"), getAllHubsRevenueSummary);
router.get("/hubs/:hubId/revenue-summary", authorize("admin", "school"), getHubRevenueSummary);
router.post("/hubs/:hubId/generate-charges/preview", authorize("admin", "school"), previewGenerateCharges);
router.post("/hubs/:hubId/generate-charges", authorize("admin", "school"), generateCharges);

router.get("/", authorize("admin", "school"), listVisits);
router.post("/", authorize("admin", "school"), logVisit);
router.get("/:id", authorize("admin", "school"), getVisit);
router.patch("/:id", authorize("admin", "school"), updateVisit);
router.delete("/:id", authorize("admin", "school"), deleteVisit);

module.exports = router;
