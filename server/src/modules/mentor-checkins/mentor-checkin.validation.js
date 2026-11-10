const { z } = require("zod");
const { meetingLinkSchema } = require("../learning-hubs/learning-hub.validation");
// Templates are the same as quality assurance's (qa.rules.js), so their shape is checked the same way.
const { templateSchema, templateStatusSchema } = require("../qa/qa.validation");
const { WEEKDAYS } = require("./mentor-checkin.rules");

const date = (message = "Use a date") => z.string().regex(/^\d{4}-\d{2}-\d{2}$/, message);
const time = (message = "Use a time like 15:00") => z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, message);
const id = (message) => z.string({ error: message }).min(1, message).max(36);

// A round's settings: the class, the families, when and how. The service checks them against the
// class (its families, its educators) and the notice period.
const roundSettings = {
  classId: id("Choose the class"),
  parentUserIds: z.array(z.string().min(1).max(36)).min(1, "Choose at least one family").max(500, "That's too many families"),
  windowStart: date("Choose the first day"),
  windowEnd: date("Choose the last day"),
  days: z.array(z.enum(WEEKDAYS)).min(1, "Choose at least one day of the week"),
  dayStart: time("Choose when the day's check-ins start"),
  dayEnd: time("Choose when the day's check-ins end"),
  minutes: z.coerce.number().int().min(5, "A check-in is at least 5 minutes").max(240, "A check-in is at most 4 hours"),
  gapMinutes: z.coerce.number().int().min(0).max(120, "A gap is at most 2 hours").optional().default(0),
  // "spread": families spaced across the whole window; "earliest": the first free times in order.
  spread: z.enum(["spread", "earliest"]).optional().default("spread"),
};

const previewSchema = z.object(roundSettings);

const roundSchema = z.object({
  ...roundSettings,
  format: z.enum(["online", "in_person"], { message: "Online or in person?" }),
  meetingLink: meetingLinkSchema.optional().nullable().transform((v) => v || null),
  location: z.string().trim().max(255, "The place is too long").optional().nullable().transform((v) => v || null),
  templateId: z.string().max(36).optional().nullable().transform((v) => v || null),
  // The times from the draw (the admin may have swapped some): one per family.
  meetings: z.array(z.object({
    parentUserId: id("A family is missing"),
    date: date(),
    startTime: time(),
  })).min(1, "Give at least one family a time").max(500),
});

const roundUpdateSchema = z.object({
  meetingLink: meetingLinkSchema.optional().nullable().transform((v) => (v === undefined ? undefined : v || null)),
  location: z.string().trim().max(255).optional().nullable(),
  templateId: z.string().max(36).optional().nullable(),
});

const listMeetingsSchema = z.object({
  view: z.enum(["coming", "todo", "done", "all"]).optional().default("coming"),
  roundId: z.string().max(36).optional(),
});

const timeSchema = z.object({ date: date("Choose a day"), startTime: time("Choose a time") });

// The report: how the child is doing and what was agreed (rich text), and the template's answers.
const text = z.string().trim().max(50000, "That part of the report is too long").optional().nullable().transform((v) => v || "");
const reportSchema = z.object({
  summary: text,
  actions: text,
  answers: z.record(z.string(), z.object({
    value: z.union([z.string().max(20), z.number()]).optional().nullable(),
    comment: z.string().max(2000, "A comment is too long").optional().nullable(),
  })).optional().default({}),
});

const approveSchema = z.object({ comment: z.string().max(2000, "Your note is too long").optional().nullable() });
const missedSchema = z.object({ missed: z.boolean().optional().default(true) });

module.exports = {
  previewSchema, roundSchema, roundUpdateSchema, listMeetingsSchema, timeSchema, reportSchema, approveSchema, missedSchema,
  templateSchema, templateStatusSchema,
};
