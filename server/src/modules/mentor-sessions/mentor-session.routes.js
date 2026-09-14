const express = require("express");
const {
  createSession,
  getAllSessions,
  getSessionById,
  updateSession,
  deleteSession,
  getHubRevenueSummary,
} = require("./mentor-session.controller");

const router = express.Router();

// Admin-only — gated at the app.js mount, same as competitions/bootcamps.
router.get("/hub-revenue/:hubId", getHubRevenueSummary);
router.route("/").get(getAllSessions).post(createSession);
router.route("/:id").get(getSessionById).put(updateSession).delete(deleteSession);

module.exports = router;
