const { z } = require("zod");

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be in YYYY-MM-DD format");

// One session on a class's calendar.
const sessionRefSchema = z.object({
  classId: z.string().min(1),
  courseId: z.string().min(1),
  sessionId: z.string().min(1),
  date: dateOnly,
});

const requestCoverSchema = sessionRefSchema.extend({
  coverTeacherId: z.string().min(1, "Choose who will cover"),
  note: z.string().trim().max(1000).optional().nullable(),
});

const respondSchema = z.object({
  decision: z.enum(["accept", "decline"]),
  reason: z.string().trim().max(300).optional().nullable(),
});

const cancelSchema = z.object({
  reason: z.string().trim().max(300).optional().nullable(),
});

const attendanceSchema = z.object({
  records: z.array(z.object({
    learnerId: z.string().min(1),
    status: z.enum(["present", "absent", "late", "excused"]),
  })).min(1).max(500),
});

const taughtSchema = z.object({ note: z.string().trim().max(500).optional().nullable() });

module.exports = { sessionRefSchema, requestCoverSchema, respondSchema, cancelSchema, attendanceSchema, taughtSchema };
