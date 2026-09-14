const { z } = require("zod");

const PAYMENT_STATUSES = ["unpaid", "paid", "waived"];

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

const mentorSessionFields = z.object({
  hubId:      z.string().min(1, "Hub is required"),
  teacherId:  z.string().min(1, "Mentor is required"),
  learnerId:  z.string().min(1, "Learner is required"),
  sessionDate: dateStr,
  durationMinutes: z.coerce.number().int().min(1).max(1440).optional().nullable(),
  feeAmount:  z.coerce.number().int().min(0).max(10000000).optional().nullable(),
  feeCurrency: z.string().trim().max(8).optional().default("KES"),
  paymentStatus: z.enum(PAYMENT_STATUSES).optional().default("unpaid"),
  notes: z.string().trim().max(1000).optional().default(""),
});

const createMentorSessionSchema = mentorSessionFields;
const updateMentorSessionSchema = mentorSessionFields.partial();

module.exports = {
  createMentorSessionSchema,
  updateMentorSessionSchema,
  MENTOR_SESSION_PAYMENT_STATUSES: PAYMENT_STATUSES,
};
