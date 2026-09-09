const express = require("express");
const rateLimit = require("express-rate-limit");
const { getDiagnostic, getDiagnosticAvailability, getAttemptReport, submitDiagnostic } = require("./public-diagnostic.controller");

// Unauthenticated by design — same "no session at all" shape as public-lead.routes.js and
// public-site.routes.js. digifunzi-landing's only way to reach this.
const router = express.Router();

// Submitting also writes a lead — same shape/limit as publicLeadLimiter in
// public-lead.routes.js (20/15min/IP), since this is structurally the same kind of endpoint
// (a form submission that creates a record and notifies admins), just with grading attached.
const submitLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many submissions. Please try again later." },
});

// Tighter than submit — this is the one route that could be probed repeatedly to reconstruct an
// assessment's correct answers by observing which sanitized projections come back across many
// requests (no lead/record is created by a GET, so there's no natural cost slowing that down the
// way there is for submit).
const readLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests. Please try again later." },
});

// `/diagnostics/attempts/:attemptId` before `/diagnostics/:pathwayIdOrSlug` so the literal
// "attempts" segment can't be captured as a pathway slug. Same readLimiter — it's a GET that
// creates no record; the uuid is unguessable so probing it is pointless, but the ceiling still
// caps a runaway client.
router.get("/diagnostics/attempts/:attemptId", readLimiter, getAttemptReport);
router.get("/diagnostics/:pathwayIdOrSlug", readLimiter, getDiagnostic);
router.get("/diagnostics/:pathwayIdOrSlug/availability", readLimiter, getDiagnosticAvailability);
router.post("/diagnostics/:pathwayIdOrSlug/submit", submitLimiter, submitDiagnostic);

module.exports = router;
