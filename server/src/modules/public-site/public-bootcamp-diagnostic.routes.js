const express = require("express");
const rateLimit = require("express-rate-limit");
const { getDiagnostic, getDiagnosticAvailability, getAttemptReport, submitDiagnostic } = require("./public-bootcamp-diagnostic.controller");

// Mirrors public-diagnostic.routes.js exactly (same rate limits/reasoning), scoped to bootcamps.
const router = express.Router();

const submitLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many submissions. Please try again later." },
});

const readLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests. Please try again later." },
});

// `/bootcamp-diagnostics/attempts/:attemptId` before `/bootcamp-diagnostics/:bootcampIdOrSlug` so
// the literal "attempts" segment can't be captured as a bootcamp slug.
router.get("/bootcamp-diagnostics/attempts/:attemptId", readLimiter, getAttemptReport);
router.get("/bootcamp-diagnostics/:bootcampIdOrSlug", readLimiter, getDiagnostic);
router.get("/bootcamp-diagnostics/:bootcampIdOrSlug/availability", readLimiter, getDiagnosticAvailability);
router.post("/bootcamp-diagnostics/:bootcampIdOrSlug/submit", submitLimiter, submitDiagnostic);

module.exports = router;
