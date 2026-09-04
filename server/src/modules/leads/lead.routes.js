const express = require("express");
const {
  getAllLeads,
  updateLeadStatus,
  getLeadTimeline,
  replyToLead,
  addLeadNote,
} = require("./lead.controller");

// Mounted in app.js behind protect + authorize("admin") — the Enquiries page. Read/triage plus
// the reply/notes thread; nothing here ever creates a Learner record (see lead.service.js's
// module comment).
const router = express.Router();

router.get("/", getAllLeads);
router.patch("/:id/status", updateLeadStatus);
router.get("/:id/timeline", getLeadTimeline);
router.post("/:id/reply", replyToLead);
router.post("/:id/notes", addLeadNote);

module.exports = router;
