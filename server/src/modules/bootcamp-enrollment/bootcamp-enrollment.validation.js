const { z } = require("zod");

// Mirrors lead.validation.js's phone pattern — same reasoning: the website already validates
// client-side, this is the server-side copy so a request bypassing the browser can't skip it.
const phone = z
  .string()
  .trim()
  .min(7, "Enter a valid phone number")
  .max(20, "Enter a valid phone number")
  .regex(/^[+0-9()\-\s]+$/, "Enter a valid phone number");

// POST /api/public/bootcamp-enrollments body. Unlike the generic lead schema (parentPhone
// optional), phone is REQUIRED here — this parent becomes the account's real contact, not an
// optional follow-up channel. bootcampIdOrSlug/attemptId are never shown to the visitor; they
// come from whichever bootcamp page/diagnostic report the form is rendered on.
//
// username/password are the learner's OWN chosen login (see auth.service.js's
// setOrCreatePasswordByUsername) — the visitor picks both on the form instead of the system
// minting a firstname.lastname@digifunzi.com address and an 8-digit temporary password. Same
// username shape as learner.validation.js's own field so the two stay consistent; password only
// needs to be memorable (this is a bootcamp learner's own account, not staff), so just a length
// floor rather than a complexity policy.
const submitBootcampEnrollmentSchema = z.object({
  bootcampIdOrSlug: z.string().trim().min(1, "Bootcamp is required"),
  parentName: z.string().trim().min(2, "Please enter your name").max(120),
  parentEmail: z.string().trim().email("Enter a valid email address").max(160),
  parentPhone: phone,
  learnerName: z.string().trim().min(2, "Please enter the learner's name").max(120),
  learnerAge: z.coerce.number().int().min(3).max(19),
  username: z.string().trim().min(3, "Username must be at least 3 characters").max(30, "Username must be at most 30 characters")
    .regex(/^[a-zA-Z0-9._-]+$/, "Only letters, numbers, dots, underscores, and hyphens are allowed"),
  password: z.string().min(6, "Password must be at least 6 characters").max(72),
  // Which of the bootcamp's hubs (bootcamp_hubs) the visitor wants to attend — required only
  // when the bootcamp actually runs at more than one; the service falls back to auto-picking
  // when this is omitted (single-hub bootcamps never show the picker at all).
  hubId: z.string().trim().max(64).optional().nullable(),
  // Ties back to the diagnostic attempt that led here, for audit/analytics — never validated
  // against a real attempt row, never required (a visitor could reach the enroll form without
  // having taken the diagnostic first).
  attemptId: z.string().trim().max(100).optional().nullable(),
});

// POST /api/leads/:id/mark-paid body — a manually-recorded cash payment. amount is entered by
// the admin (there's no automated price lookup at payment time — see
// bootcamp-enrollment.service.js's markLeadPaid), defaulting client-side to the bootcamp's own
// priceAmount but always editable/confirmable since this is what was ACTUALLY received.
const markLeadPaidSchema = z.object({
  amount: z.coerce.number().positive("Enter the amount received"),
  currency: z.string().trim().max(8).optional().default("KES"),
  description: z.string().trim().max(255).optional().nullable(),
});

module.exports = { submitBootcampEnrollmentSchema, markLeadPaidSchema };
