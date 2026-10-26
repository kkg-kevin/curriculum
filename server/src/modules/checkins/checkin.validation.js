const { z } = require("zod");
const { FREQUENCIES, FORMATS } = require("./checkin.constants");

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

// The report: highs, lows, resolutions. Each is checked for being filled in by checkin.rules.js,
// so every missing one is named at once.
const text = z.string().trim().max(6000).optional().nullable().transform((v) => v || "");
const reportSchema = z.object({ highs: text, lows: text, resolutions: text });

module.exports = { scheduleSchema, listSessionsSchema, reportSchema };
