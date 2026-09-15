const express = require("express");
const {
  getAllLeads,
  updateLeadStatus,
  getLeadTimeline,
  replyToLead,
  addLeadNote,
} = require("./lead.controller");
// A bootcamp-enrollment lead is the one kind of lead that DOES already have a provisioned
// Learner (see bootcamp-enrollment.service.js) — markLeadPaid lives in that module (it owns the
// billing/learner-unlock orchestration), just exposed here alongside the rest of the Enquiries
// page's actions rather than as a separate protected router.
const { markLeadPaid } = require("../bootcamp-enrollment/bootcamp-enrollment.controller");

// Mounted in app.js behind protect + authorize("admin") — the Enquiries page. Read/triage plus
// the reply/notes thread; nothing here (aside from markLeadPaid) ever creates a Learner record
// (see lead.service.js's module comment).
const router = express.Router();

router.get("/", getAllLeads);
router.patch("/:id/status", updateLeadStatus);
router.get("/:id/timeline", getLeadTimeline);
router.post("/:id/reply", replyToLead);
router.post("/:id/notes", addLeadNote);
router.post("/:id/mark-paid", markLeadPaid);

module.exports = router;
