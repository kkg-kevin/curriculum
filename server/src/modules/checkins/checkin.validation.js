const { z } = require("zod");
const { FREQUENCIES, FORMATS } = require("./checkin.constants");
const { hasContent } = require("./checkin.rules");

const date = (message = "Use a date") => z.string().regex(/^\d{4}-\d{2}-\d{2}$/, message);
const id = (message) => z.string({ error: message }).min(1, message).max(36);

// A schedule: which hub, how often, the first check-in, and online or in person. Its Account
// Manager and Training Lead are the hub's own (learning_hubs.accountManagerId / trainingLeadId).
const scheduleSchema = z.object({
  hubId: id("Choose the hub"),
  frequency: z.enum(FREQUENCIES, { message: "Choose how often" }),
  startDate: date("Choose the date of the first check-in"),
  format: z.enum(FORMATS, { message: "Online or in person?" }),
});

const listSessionsSchema = z.object({
  scope: z.enum(["mine", "all"]).optional().default("mine"),
  view: z.enum(["due", "upcoming", "reported", "all"]).optional().default("due"),
  hubId: z.string().max(36).optional(),
  staffId: z.string().max(36).optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
});

// The report: highs, lows, resolutions — each rich text (HTML from the editor; shown through the
// client's sanitizeHtml). Each is checked for being filled in by checkin.rules.js, so every
// missing one is named at once.
const text = z.string().trim().max(50000, "That part of the report is too long").optional().nullable().transform((v) => v || "");
const reportSchema = z.object({ highs: text, lows: text, resolutions: text });

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

module.exports = { scheduleSchema, listSessionsSchema, reportSchema, taskSchema, taskStatusSchema, listTasksSchema };
