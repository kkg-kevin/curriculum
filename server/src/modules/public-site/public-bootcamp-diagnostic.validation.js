const { z } = require("zod");

// Mirrors public-diagnostic.validation.js exactly — same answer/contact shape, since this is the
// same feature (anonymous visitor takes a short auto-graded quiz, gives a name+phone to see the
// report), just scoped to a Bootcamp instead of a Pathway.
const answerSchema = z.object({
  itemId: z.string().min(1),
  response: z.any(),
});

const phone = z
  .string()
  .trim()
  .min(7, "Enter a valid phone number")
  .max(20, "Enter a valid phone number")
  .regex(/^[+0-9()\-\s]+$/, "Enter a valid phone number");

const submitBootcampDiagnosticSchema = z.object({
  answers: z.array(answerSchema).default([]),
  parentName: z.string().trim().min(2, "Please enter your name").max(120),
  parentPhone: phone,
  childName: z.string().trim().max(120).optional().or(z.literal("")),
  childAge: z.coerce.number().int().min(3).max(19),
});

module.exports = { submitBootcampDiagnosticSchema };
