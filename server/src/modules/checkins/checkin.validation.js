const { z } = require("zod");
const { FREQUENCIES, FORMATS } = require("./checkin.constants");
const { hasContent } = require("./checkin.rules");
const { meetingLinkSchema } = require("../learning-hubs/learning-hub.validation");
// Templates are the same as quality assurance's (qa.rules.js), so their shape is checked the same way.
const { templateSchema, templateStatusSchema } = require("../qa/qa.validation");

const date = (message = "Use a date") => z.string().regex(/^\d{4}-\d{2}-\d{2}$/, message);
const id = (message) => z.string({ error: message }).min(1, message).max(36);

// A schedule: which hub, how often, the first check-in, and online or in person. Its Account
// Manager and Training Lead are the hub's own (learning_hubs.accountManagerId / trainingLeadId).
const scheduleSchema = z.object({
  hubId: id("Choose the hub"),
  frequency: z.enum(FREQUENCIES, { message: "Choose how often" }),
  startDate: date("Choose the date of the first check-in"),
  format: z.enum(FORMATS, { message: "Online or in person?" }),
  // Optional — without one the report is the highs, lows and resolutions only.
  templateId: z.string().max(36).optional().nullable().transform((v) => v || null),
  // Who takes part (6 Nov 2026): logins chosen from the hub's people — checked against
  // participantOptions in checkin.service.js. The Account Manager and Training Lead always do.
  participantIds: z.array(z.string().min(1).max(36)).max(3000, "That's too many people").optional().default([]),
  // The link to join an online check-in (any meeting link — Meet, Zoom, Teams…).
  meetingLink: meetingLinkSchema.optional().nullable().transform((v) => v || null),
});

const listSessionsSchema = z.object({
  scope: z.enum(["mine", "all"]).optional().default("mine"),
  // "coming": not reported yet, today or later — what people reading check-ins look ahead at.
  view: z.enum(["due", "upcoming", "coming", "reported", "all"]).optional().default("due"),
  hubId: z.string().max(36).optional(),
  staffId: z.string().max(36).optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
});

// The report: highs, lows, resolutions — each rich text (HTML from the editor; shown through the
// client's sanitizeHtml). Each is checked for being filled in by checkin.rules.js, so every
// missing one is named at once.
const text = z.string().trim().max(50000, "That part of the report is too long").optional().nullable().transform((v) => v || "");
// With a template, its answers too ({ [itemId]: { value, comment } }) — checked against the
// check-in's template in checkin.service.js (qa.rules.js's cleanAnswers / reviewProblems rules).
const reportSchema = z.object({
  highs: text, lows: text, resolutions: text,
  answers: z.record(z.string(), z.object({
    value: z.union([z.string().max(20), z.number()]).optional().nullable(),
    comment: z.string().max(2000, "A comment is too long").optional().nullable(),
  })).optional().default({}),
});

// A task from the resolutions: what (rich text, like the report), who (the check-in's Account
// Manager or Training Lead, or an admin — checked in checkin.service.js), and by when.
const taskSchema = z.object({
  title: z.string({ error: "Write the task" }).trim().max(20000, "The task is too long").refine(hasContent, "Write the task"),
  assigneeId: id("Choose who does it"),
  dueDate: date("Choose the deadline"),
});
const taskStatusSchema = z.object({ status: z.enum(["open", "done"], { message: "Done or not done?" }) });
const listTasksSchema = z.object({
  scope: z.enum(["mine", "all"]).optional().default("mine"),
  view: z.enum(["open", "done", "all"]).optional().default("open"),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
});

module.exports = { scheduleSchema, listSessionsSchema, reportSchema, taskSchema, taskStatusSchema, listTasksSchema, templateSchema, templateStatusSchema };
