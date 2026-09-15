const express = require("express");
const rateLimit = require("express-rate-limit");
const { submitBootcampEnrollment } = require("./bootcamp-enrollment.controller");

// Unauthenticated by design, same posture as public-lead.routes.js — this is the digifunzi-
// landing site's only way to reach this API, and it carries no JWT. The admin-only "mark paid"
// action lives on the existing protected leads.routes.js instead (see lead.routes.js), not here.
const router = express.Router();

// Same rate-limit shape as public-lead.routes.js's publicLeadLimiter — one submission here also
// creates a lead, so the same bot/abuse posture applies.
const publicBootcampEnrollmentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many submissions. Please try again later." },
});

router.post("/bootcamp-enrollments", publicBootcampEnrollmentLimiter, submitBootcampEnrollment);

module.exports = router;
