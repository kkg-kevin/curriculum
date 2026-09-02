const express = require("express");
const { getAllLeads, updateLeadStatus } = require("./lead.controller");

// Mounted in app.js behind protect + authorize("admin") — the Enquiries page. Read/triage only;
// nothing here ever creates a Learner record (see lead.service.js's module comment).
const router = express.Router();

router.get("/", getAllLeads);
router.patch("/:id/status", updateLeadStatus);

module.exports = router;
