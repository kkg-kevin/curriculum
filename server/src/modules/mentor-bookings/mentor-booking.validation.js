const { z } = require("zod");

// Request shapes for mentor bookings. The rules (who may, and when) are in mentor-booking.service.js.
const idStr = z.string().min(1).max(64);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date");
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Pick a time");
const optionalId = idStr.nullable().optional();

const optionsSchema = z.object({ learnerId: idStr, teacherId: idStr });

const freeTimesSchema = z.object({
  learnerId: idStr,
  teacherId: idStr,
  minutes: z.coerce.number().int().positive(),
  hubId: optionalId,
  spaceId: optionalId,
  from: date.optional(),
  to: date.optional(),
});

const bookSchema = z.object({
  learnerId: idStr,
  teacherId: idStr,
  minutes: z.coerce.number().int().positive(),
  date,
  startTime: time,
  mode: z.enum(["online", "hub"], { errorMap: () => ({ message: "Choose online or at a hub" }) }),
  hubId: optionalId,
  spaceId: optionalId,
  courseId: optionalId,
  sessionId: optionalId,
  topic: z.string().max(1000).optional().default(""),
  helpRequestId: optionalId,
}).refine((d) => d.mode !== "hub" || (d.hubId && d.spaceId), { message: "Choose the hub and the space", path: ["spaceId"] });

const listSchema = z.object({
  teacherId: idStr.optional(),
  hubId: idStr.optional(),
  learnerId: idStr.optional(),
  refunds: z.preprocess((v) => v === "1" || v === "true" || v === true, z.boolean()).optional(),
});

const cancelSchema = z.object({ reason: z.string().max(500).optional().default("") });
const markSchema = z.object({ outcome: z.enum(["completed", "no_show"]), note: z.string().max(5000).optional().default("") });
const linkSchema = z.object({ meetingLink: z.string().trim().max(500).refine((v) => !v || /^https?:\/\//i.test(v), "Paste the full link, starting with https://").nullable() });
const refundSchema = z.object({ reference: z.string().max(120).optional().default("") });

const helpSchema = z.object({
  learnerId: optionalId,
  courseId: optionalId,
  sessionId: optionalId,
  message: z.string().max(1000).optional().default(""),
});

const settleSchema = z.object({
  method: z.enum(["mpesa", "bank", "cash", "offset"], { errorMap: () => ({ message: "Choose how it was settled" }) }),
  reference: z.string().max(120).optional().default(""),
  offsetInvoiceId: optionalId,
  note: z.string().max(500).optional().default(""),
});

const settingsSchema = z.object({
  enabled: z.boolean(),
  lengths: z.array(z.object({
    minutes: z.coerce.number().int(),
    price: z.coerce.number().nonnegative().nullable(),
    educatorPay: z.coerce.number().nonnegative().nullable(),
  })).max(5),
  noticeHours: z.coerce.number().int().min(1).max(336),
  holdMinutes: z.coerce.number().int().min(15).max(2880),
  cancelHours: z.coerce.number().int().min(0).max(336),
  horizonDays: z.coerce.number().int().min(3).max(90).optional(),
});

module.exports = { optionsSchema, freeTimesSchema, bookSchema, listSchema, cancelSchema, markSchema, linkSchema, refundSchema, helpSchema, settleSchema, settingsSchema };
