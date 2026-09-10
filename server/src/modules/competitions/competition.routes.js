const express = require("express");
const {
  createCompetition,
  getAllCompetitions,
  getCompetitionById,
  updateCompetition,
  deleteCompetition,
} = require("./competition.controller");

const router = express.Router();

// Admin-only — gated at the app.js mount, same as programs / competencies / inventory.
router.route("/").get(getAllCompetitions).post(createCompetition);
router.route("/:id").get(getCompetitionById).put(updateCompetition).delete(deleteCompetition);

module.exports = router;
