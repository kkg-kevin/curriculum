const express = require("express");
const rateLimit = require("express-rate-limit");
const asyncHandler = require("express-async-handler");
const { z } = require("zod");
const PathwayEnrollmentService = require("./pathway-enrollment.service");
const { visitSourceFrom } = require("../leads/visit-source");
const { enrollmentChildSchema, withChildren, phone } = require("../bootcamp-enrollment/bootcamp-enrollment.validation");

// Unauthenticated by design — the website's paid pathway enrolment (pathway-enrollment.service.js),
// same posture and rate limit as the bootcamp enrolment.
const router = express.Router();

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many submissions. Please try again later." },
});

// POST /api/public/pathway-enrollments body: the pathway (from the page the form is on), the hub
// the family chose (one of the pathway's), the parent (their password, or a parent token from a
// sign-in / earlier enrolment) and 1–6 children with their own logins.
const submitPathwayEnrollmentSchema = z.preprocess(withChildren, z.object({
  pathwayIdOrSlug: z.string().trim().min(1, "Pathway is required").max(200),
  hubId: z.string().trim().min(1, "Choose a hub").max(64),
  parentName: z.string().trim().min(2, "Please enter your name").max(120),
  parentEmail: z.string().trim().email("Enter a valid email address").max(160),
  parentPhone: phone,
  parentPassword: z.string().min(6, "Your password must be at least 6 characters").max(72).optional(),
  parentToken: z.string().trim().max(2000).optional(),
  children: z.array(enrollmentChildSchema).min(1, "Add at least one learner").max(6, "Up to 6 learners in one enrolment"),
  attemptId: z.string().trim().max(100).optional().nullable(),
  // A subscription plan of this pathway (Billing → Packages → Pathway plans) — required by the
  // service — and how often the family chose to pay (one of the plan's periods; left out, the
  // plan's shown-first period). Without it here the parse dropped it and every enrolment was
  // billed at the default period.
  packageId: z.string().trim().max(64).optional().nullable(),
  billingPeriod: z.enum(["weekly", "monthly", "quarterly", "annually"]).optional().nullable(),
}).superRefine((data, ctx) => {
  if (!data.parentPassword && !data.parentToken) ctx.addIssue({ code: "custom", path: ["parentPassword"], message: "Enter your password" });
  const seen = new Set();
  data.children.forEach((child, i) => {
    const key = child.username.toLowerCase();
    if (seen.has(key)) ctx.addIssue({ code: "custom", path: ["children", i, "username"], message: "Each learner needs their own username" });
    seen.add(key);
  });
}));

router.post("/pathway-enrollments", limiter, asyncHandler(async (req, res) => {
  const data = submitPathwayEnrollmentSchema.parse(req.body);
  const result = await PathwayEnrollmentService.submit(data, visitSourceFrom(req));
  res.status(201).json({ success: true, data: result });
}));

module.exports = router;
