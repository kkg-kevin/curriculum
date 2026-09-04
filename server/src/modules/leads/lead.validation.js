const { z } = require("zod");

// Mirrors digifunzi-landing's src/components/forms/schemas.js exactly — that frontend already
// validates client-side; this is the server-side copy of the same contract so a request that
// bypasses the browser (curl, a bot working around the honeypot) can't skip validation.
const phone = z
  .string()
  .trim()
  .min(7, "Enter a valid phone number")
  .max(20, "Enter a valid phone number")
  .regex(/^[+0-9()\-\s]+$/, "Enter a valid phone number");

const INTEREST_VALUES = ["bootcamp", "project", "quarky", "general"];

// POST /api/public/leads body — EnrollForm.jsx's payload shape (parentName/parentEmail/... +
// referenceId/note), with interestedIn defaulted to "general" since ContactForm.jsx reuses this
// same endpoint/schema when useLeadsEndpoint is on.
const createLeadSchema = z.object({
  parentName: z.string().trim().min(2, "Please enter your name").max(120),
  parentEmail: z.string().trim().email("Enter a valid email address").max(160),
  parentPhone: phone.optional().or(z.literal("")),
  learnerName: z.string().trim().max(120).optional().or(z.literal("")),
  learnerAge: z.coerce.number().int().min(3).max(19).optional().nullable(),
  interestedIn: z.enum(INTEREST_VALUES).optional().default("general"),
  referenceId: z.string().trim().max(100).optional().nullable(),
  note: z.string().trim().max(1000).optional().or(z.literal("")),
});

// POST /api/public/contact body — ContactForm.jsx's default (non-leads-endpoint) payload.
const createContactSchema = z.object({
  name: z.string().trim().min(2, "Please enter your name").max(120),
  email: z.string().trim().email("Enter a valid email address").max(160),
  phone: phone.optional().or(z.literal("")),
  message: z.string().trim().min(10, "Please add a little more detail").max(2000),
});

// Admin Enquiries page — the only two things staff change on a lead.
const updateLeadStatusSchema = z.object({
  status: z.enum(["new", "contacted", "closed"]),
});

// POST /api/leads/:id/reply — staff compose box. subject is optional (lead.emails.js falls back
// to a generic "Re: your enquiry" line); body is what actually gets emailed.
const replyLeadSchema = z.object({
  subject: z.string().trim().max(200).optional().or(z.literal("")),
  body: z.string().trim().min(1, "Reply body is required").max(5000),
});

// POST /api/leads/:id/notes — staff-only, never emailed.
const addLeadNoteSchema = z.object({
  body: z.string().trim().min(1, "Note is required").max(2000),
});

module.exports = {
  createLeadSchema,
  createContactSchema,
  updateLeadStatusSchema,
  replyLeadSchema,
  addLeadNoteSchema,
  INTEREST_VALUES,
};
