const express = require("express");
const asyncHandler = require("express-async-handler");
const { authorize } = require("../../shared/middleware/auth.middleware");
const { summary } = require("./dashboard.service");

// The admin dashboard's own figures (dashboard.service.js), mounted at /api/dashboard with protect
// + attachOwnRecords (app.js). The workspace's admins, and staff — every staff role may open it
// (access.registry.js), and the service leaves out what their role can't view.
const router = express.Router();
router.get("/", authorize("admin"), asyncHandler(async (req, res) => {
  res.json({ success: true, data: await summary(req) });
}));

module.exports = router;
