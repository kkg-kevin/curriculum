const { z } = require("zod");

// { itemId, response } — response shape depends on item kind (string for mcq/trueFalse,
// string[] for fillBlank/ordering, [{left,right}] for matching) — same permissive `z.any()`
// posture as assessment-submission.validation.js's own answerSchema, since grading.utils.js
// already handles shape mismatches defensively per kind.
const answerSchema = z.object({
  itemId: z.string().min(1),
  response: z.any(),
});

// POST /api/public/diagnostics/:slug/submit — grades and returns the report ONLY. No contact
// info: the anonymous visitor sees their result straight after submitting, with nothing asked
// upfront. `childAge` is still required — it must be inside the pathway's configured range
// (same gate as the GET), and `childName` is optional context stored on the attempt. No lead is
// created here any more; the visitor enrols via the normal /enroll form afterwards (which
// collects name/email), pre-filled with the pathway.
const submitDiagnosticSchema = z.object({
  answers: z.array(answerSchema).default([]),
  childName: z.string().trim().max(120).optional().or(z.literal("")),
  childAge: z.coerce.number().int().min(3).max(19),
});

module.exports = { submitDiagnosticSchema };
