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
const submitBootcampEnrollmentSchema = z.object({
  bootcampIdOrSlug: z.string().trim().min(1, "Bootcamp is required"),
  parentName: z.string().trim().min(2, "Please enter your name").max(120),
  parentEmail: z.string().trim().email("Enter a valid email address").max(160),
  parentPhone: phone,
  learnerName: z.string().trim().min(2, "Please enter the learner's name").max(120),
  learnerAge: z.coerce.number().int().min(3).max(19),
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
