const express = require("express");
const rateLimit = require("express-rate-limit");
const { submitLead, submitContact } = require("./lead.controller");

// Deliberately mounted in app.js WITHOUT `protect` — same "one route with no session at all"
// shape as learners/public-profile.routes.js. This is the digifunzi-landing site's only way to
// reach this API (see that repo's src/services/api.js — it carries no JWT by design).
const router = express.Router();

// Unlike loginLimiter (auth.routes.js), every request here is a "success" from the server's
// point of view — there's no failed-attempt signal to key off, and the risk is a bot mass-filling
// the form itself (the frontend's Honeypot.jsx already blocks the naive case, but that's
// client-side and skippable). Generous enough for a real family submitting both forms, or a
// shared school-network IP submitting for a few different kids, without being an open spam relay.
const publicLeadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many submissions. Please try again later." },
});

router.post("/leads", publicLeadLimiter, submitLead);
router.post("/contact", publicLeadLimiter, submitContact);

module.exports = router;
