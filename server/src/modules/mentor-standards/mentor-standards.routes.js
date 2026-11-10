const express = require("express");
const asyncHandler = require("express-async-handler");
const { authorize } = require("../../shared/middleware/auth.middleware");
const MentorStandardsService = require("./mentor-standards.service");

// Settings → Mentor standards (admins; staff through the Settings permission — access.registry.js).
// A mentor's standing itself comes with their profile (educator-profiles) and Reports → Educators.
const router = express.Router();
const ok = (res, data) => res.json({ success: true, data });

router.get("/settings", authorize("admin"), asyncHandler(async (req, res) => ok(res, await MentorStandardsService.settingsView(req))));
router.put("/settings", authorize("admin"), asyncHandler(async (req, res) => ok(res, await MentorStandardsService.saveSettings(req, req.body || {}))));

module.exports = router;
