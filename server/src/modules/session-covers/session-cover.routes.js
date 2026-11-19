const express = require("express");
const { candidates, requestCover, myCovers, listCovers, respond, cancel, coverPage, markAttendance, markTaught } = require("./session-cover.controller");
const { authorize } = require("../../shared/middleware/auth.middleware");

// Session covers (19 Nov 2026) — one educator teaches one session of another's class.
// Static paths before "/:id".
const router = express.Router();

router.get("/candidates", authorize("admin", "school", "teacher"), candidates);
router.get("/mine", authorize("teacher"), myCovers);
router.get("/", authorize("admin", "school"), listCovers);
router.post("/", authorize("admin", "school", "teacher"), requestCover);

router.post("/:id/respond", authorize("teacher"), respond);
router.post("/:id/cancel", authorize("admin", "school", "teacher"), cancel);
router.get("/:id/page", authorize("teacher"), coverPage);
router.post("/:id/attendance", authorize("teacher"), markAttendance);
router.post("/:id/taught", authorize("teacher"), markTaught);

module.exports = router;
