const { z } = require("zod");

// { itemId, response } — response shape depends on item kind (string for mcq/trueFalse,
// string[] for fillBlank/ordering, [{left,right}] for matching) — same permissive `z.any()`
// posture as assessment-submission.validation.js's own answerSchema, since grading.utils.js
// already handles shape mismatches defensively per kind.
const answerSchema = z.object({
  itemId: z.string().min(1),
  response: z.any(),
});

// POST /api/public/diagnostics/:slug/submit — grades, creates a lead, and returns the report.
// The visitor must give a name + phone before seeing their result (source: "diagnostic" lead,
// admins notified). `childAge` is still required — it must be inside the pathway's configured
// range (same gate as the GET). `childName` stays optional context for the report.
// `parentPhone` mirrors the enrol/contact form's phone rule (7–20 chars, +0-9()- only).
const phone = z
  .string()
  .trim()
  .min(7, "Enter a valid phone number")
  .max(20, "Enter a valid phone number")
  .regex(/^[+0-9()\-\s]+$/, "Enter a valid phone number");

const submitDiagnosticSchema = z.object({
  answers: z.array(answerSchema).default([]),
  parentName: z.string().trim().min(2, "Please enter your name").max(120),
  parentPhone: phone,
  childName: z.string().trim().max(120).optional().or(z.literal("")),
  childAge: z.coerce.number().int().min(3).max(19),
});

module.exports = { submitDiagnosticSchema };
