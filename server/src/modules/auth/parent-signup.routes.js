const express = require("express");
const rateLimit = require("express-rate-limit");
const { perAccountKey } = require("../../shared/middleware/rate-limit.middleware");
const asyncHandler = require("express-async-handler");
const { z } = require("zod");
const { signInParent } = require("./parent-signup");

// Unauthenticated by design — "Already have a Digifunzi account? Sign in" on a website sign-up.
// Hands back a short-lived parent token (parent-signup.js) and the details to fill the form with;
// it never starts a portal session. Rate-limited tighter than a sign-up, since it checks a
// password.
const router = express.Router();

// Per account (address + email — perAccountKey), so one family's wrong passwords never block
// another's.
const parentSignInLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  keyGenerator: perAccountKey((req) => req.body?.email),
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many sign-in attempts. Please try again later." },
});

const parentSignInSchema = z.object({
  email: z.string().trim().email("Enter a valid email address").max(160),
  password: z.string().min(1, "Enter your password").max(72),
});

router.post("/parent-sign-in", parentSignInLimiter, asyncHandler(async (req, res) => {
  const { email, password } = parentSignInSchema.parse(req.body);
  res.json({ success: true, data: await signInParent(email, password) });
}));

module.exports = router;
