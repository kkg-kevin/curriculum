const express = require("express");
const {
  createCompetition,
  getAllCompetitions,
  getCompetitionById,
  updateCompetition,
  deleteCompetition,
  listOfferings,
  createOffering,
  deleteOffering,
} = require("./competition.controller");

const router = express.Router();

// Admin-only — gated at the app.js mount, same as bootcamps / competencies / inventory.
router.route("/").get(getAllCompetitions).post(createCompetition);
router.route("/:id").get(getCompetitionById).put(updateCompetition).delete(deleteCompetition);
// Hub-offerings — "run this competition at a hub", replacing the old standalone Event-deployment
// flow. Nested under the parent since an offering has no identity outside its competition.
router.route("/:id/hubs").get(listOfferings).post(createOffering);
router.route("/:id/hubs/:offeringId").delete(deleteOffering);

module.exports = router;
