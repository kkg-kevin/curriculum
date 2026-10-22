const { z } = require("zod");
const {
  FREQUENCIES, FORMATS, SESSION_STATUSES, OVERALL_STATUSES, ACTION_KINDS, ACTION_STATUSES, ACTION_CATEGORIES, PRIORITIES, OPERATIONAL_STATUSES,
} = require("./checkin.constants");

const date = (message = "Use a date") => z.string().regex(/^\d{4}-\d{2}-\d{2}$/, message);
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a time like 09:30");
const text = (max) => z.string().trim().max(max).optional().nullable().transform((v) => (v ? v : null));
const id = (message) => z.string({ error: message }).min(1, message).max(36);

// ---- Schedules ----
const scheduleFields = {
  hubId: id("Choose the hub"),
  accountManagerId: id("Choose the Account Manager"),
  trainingLeadId: id("Choose the Training Lead"),
  frequency: z.enum(FREQUENCIES, { message: "Choose how often" }),
  startDate: date("Choose the date of the first check-in"),
  endDate: date().optional().nullable(),
  startTime: time,
  durationMinutes: z.coerce.number().int().min(5, "At least 5 minutes").max(600, "At most 10 hours").optional().nullable(),
  format: z.enum(FORMATS, { message: "Online or in person?" }),
  meetingLink: z.string().trim().max(500).url("Enter the full meeting link, starting https://").optional().nullable().or(z.literal("").transform(() => null)),
  venue: text(255),
  agenda: text(5000),
};
const scheduleSchema = z.object(scheduleFields)
  .refine((d) => !d.endDate || d.endDate >= d.startDate, { message: "The end date is before the first check-in", path: ["endDate"] });
const updateScheduleSchema = z.object(scheduleFields)
  .refine((d) => !d.endDate || d.endDate >= d.startDate, { message: "The end date is before the first check-in", path: ["endDate"] });
const endScheduleSchema = z.object({ reason: text(255) });

// ---- Sessions ----
const listSessionsSchema = z.object({
  scope: z.enum(["mine", "all"]).optional().default("mine"),
  view: z.enum(["upcoming", "today", "pending", "overdue", "completed", "rescheduled", "cancelled", "all"]).optional().default("all"),
  hubId: z.string().max(36).optional(),
  staffId: z.string().max(36).optional(),
  frequency: z.enum(FREQUENCIES).optional(),
  status: z.enum(SESSION_STATUSES).optional(),
  from: date().optional(),
  to: date().optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
});
const rescheduleSchema = z.object({ date: date("Choose the new date"), startTime: time, reason: z.string().trim().min(3, "Say why it's being moved").max(255) });
const reasonSchema = z.object({ reason: z.string().trim().min(3, "Give a reason").max(255) });

// The report form — sections A–D, F's notes and G. E (challenges) and F's follow-ups are their own
// records (checkin_actions), so they can be tracked after the report is done.
const longText = text(4000);
const reportSchema = z.object({
  session: z.object({
    actualDate: date().optional().nullable(),
    participants: z.array(z.string().trim().min(1).max(150)).max(40).optional().default([]),
  }).optional().default({}),
  operations: z.object({
    generalStatus: z.enum(OPERATIONAL_STATUSES).optional().nullable(),
    dayToDay: longText, staffing: longText, facilities: longText, other: longText,
  }).optional().default({}),
  training: z.object({
    curriculumProgress: longText, educatorPreparedness: longText, learnerEngagement: longText, challenges: longText, other: longText,
  }).optional().default({}),
  achievements: z.object({
    workingWell: longText, recent: longText, improvements: longText, goodPractices: longText,
  }).optional().default({}),
  decisions: z.object({ nextSteps: longText, escalations: longText }).optional().default({}),
  summary: z.object({
    overallStatus: z.enum(OVERALL_STATUSES).optional().nullable(),
    observations: longText,
    recommendedFollowUp: longText,
    proposedNextDate: date().optional().nullable(),
  }).optional().default({}),
});

// ---- Actions ----
const actionFields = {
  kind: z.enum(ACTION_KINDS).optional().default("action"),
  title: z.string().trim().min(3, "Give it a short title").max(200),
  description: text(4000),
  impact: text(2000),
  recurring: z.boolean().optional().default(false),
  category: z.enum(ACTION_CATEGORIES, { message: "Choose a category" }),
  priority: z.enum(PRIORITIES).optional().default("medium"),
  assigneeId: z.string().max(36).optional().nullable().transform((v) => v || null),
  dueDate: date().optional().nullable().or(z.literal("").transform(() => null)),
};
const createActionSchema = z.object(actionFields);
const updateActionSchema = z.object(actionFields).partial();
const actionStatusSchema = z.object({
  status: z.enum(ACTION_STATUSES),
  note: text(2000),
  resolutionNotes: text(4000),
});
const noteSchema = z.object({ note: z.string().trim().min(2, "Write a note").max(2000) });
const escalateSchema = z.object({ note: z.string().trim().min(3, "Say why it needs escalating").max(500) });
const listActionsSchema = z.object({
  scope: z.enum(["mine", "all"]).optional().default("all"),
  status: z.enum([...ACTION_STATUSES, "outstanding"]).optional(),
  hubId: z.string().max(36).optional(),
  assigneeId: z.string().max(36).optional(),
  sessionId: z.string().max(36).optional(),
  category: z.enum(ACTION_CATEGORIES).optional(),
  overdue: z.enum(["true", "false"]).optional(),
  escalated: z.enum(["true", "false"]).optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
});

const overviewSchema = z.object({
  from: date().optional(),
  to: date().optional(),
  hubId: z.string().max(36).optional(),
  staffId: z.string().max(36).optional(),
  frequency: z.enum(FREQUENCIES).optional(),
  status: z.enum(SESSION_STATUSES).optional(),
});

module.exports = {
  scheduleSchema, updateScheduleSchema, endScheduleSchema, listSessionsSchema, rescheduleSchema, reasonSchema, reportSchema,
  createActionSchema, updateActionSchema, actionStatusSchema, noteSchema, escalateSchema, listActionsSchema, overviewSchema,
};
