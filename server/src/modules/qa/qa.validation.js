const { z } = require("zod");
const { FREQUENCIES, VISIT_TYPES } = require("./qa.constants");

const date = (message = "Use a date") => z.string().regex(/^\d{4}-\d{2}-\d{2}$/, message);
const id = (message) => z.string({ error: message }).min(1, message).max(36);
const optionalId = z.string().max(36).optional().nullable().transform((v) => v || null);

// A template's shape only — what it must contain (a name, sections, items…) is checked by
// qa.rules.js's templateProblems, so every gap is named at once.
const templateSchema = z.object({
  name: z.string().max(150, "The name is too long").optional().default(""),
  description: z.string().max(20000, "The description is too long").optional().nullable(),
  scale: z.array(z.object({ score: z.coerce.number().int().min(0).max(100), label: z.string().max(60).optional().default("") })).max(10, "A rubric has at most 10 levels").optional().default([]),
  sections: z.array(z.object({
    id: z.string().max(36).optional(),
    title: z.string().max(150).optional().default(""),
    criteria: z.array(z.object({
      id: z.string().max(36).optional(),
      text: z.string().max(500, "An item is too long").optional().default(""),
      help: z.string().max(10000, "Some guidance is too long").optional().nullable(),
      kind: z.string().max(20).optional(),
      descriptors: z.record(z.string(), z.string().max(500)).optional(),
    })).max(60, "A section has at most 60 items").optional().default([]),
  })).max(30, "A template has at most 30 sections").optional().default([]),
});
const templateStatusSchema = z.object({ status: z.enum(["active", "archived"], { message: "Active or archived?" }) });

const visitTypeField = z.enum(VISIT_TYPES, { message: "Announced or a surprise?" });

// Regular visits to one educator. The reviewer is chosen by an admin; a supervisor reviews their own.
const scheduleSchema = z.object({
  teacherId: id("Choose the educator"),
  hubId: optionalId,
  templateId: id("Choose the template"),
  reviewerId: optionalId,
  frequency: z.enum(FREQUENCIES, { message: "Choose how often" }),
  visitType: visitTypeField,
  startDate: date("Choose the date of the first visit"),
});

// One visit planned on its own (or recorded the day it happened).
const visitSchema = z.object({
  teacherId: id("Choose the educator"),
  hubId: optionalId,
  templateId: id("Choose the template"),
  reviewerId: optionalId,
  visitType: visitTypeField,
  scheduledDate: date("Choose the date of the visit"),
});

// Moving an open visit, or changing how it's done (not who is visited).
const visitUpdateSchema = visitSchema.omit({ teacherId: true });

const listVisitsSchema = z.object({
  view: z.enum(["due", "upcoming", "submitted", "cancelled", "all"]).optional().default("all"),
  teacherId: z.string().max(36).optional(),
  hubId: z.string().max(36).optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(200).optional().default(30),
});

const richText = z.string().trim().max(50000, "That part is too long").optional().nullable().transform((v) => v || "");

// The review: an answer per item, the summary, the day of the visit, and whether to send it now
// (or just keep it). Answers are checked against the visit's template in qa.rules.js.
const reviewSchema = z.object({
  answers: z.record(z.string(), z.object({
    value: z.union([z.string().max(20), z.number()]).optional().nullable(),
    comment: z.string().max(2000, "A comment is too long").optional().nullable(),
  })).optional().default({}),
  summary: z.object({ strengths: richText, improvements: richText, remarks: richText }).optional().default({}),
  visitDate: date("Choose the day of the visit").optional(),
  submit: z.boolean().optional().default(false),
});

const replySchema = z.object({ reply: richText });

module.exports = { templateSchema, templateStatusSchema, scheduleSchema, visitSchema, visitUpdateSchema, listVisitsSchema, reviewSchema, replySchema };
