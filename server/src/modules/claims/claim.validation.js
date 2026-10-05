const { z } = require("zod");

const CLAIM_TYPES = ["advance", "full"];
const CLAIM_STATUSES = ["pending_supervisor", "pending_admin", "approved", "paid", "rejected"];

// The invoice is uploaded first (POST /api/uploads/document) and only its stored path is sent
// here — so it has to be one of our own upload paths, and a PDF.
const submitClaimSchema = z.object({
  classId: z.string().min(1, "Class is required"),
  courseId: z.string().min(1, "Course is required"),
  type: z.enum(CLAIM_TYPES, { message: "Choose an advance or the full payment" }),
  invoiceUrl: z.string().regex(/^\/uploads\/[A-Za-z0-9-]+\.pdf$/i, "Upload your invoice as a PDF"),
  invoiceFilename: z.string().max(255).optional().nullable(),
  note: z.string().max(500).optional().nullable(),
});

// Declining needs a reason — it is the message the educator gets.
const decisionSchema = z
  .object({
    decision: z.enum(["approve", "reject"]),
    reason: z.string().trim().max(1000).optional().default(""),
  })
  .refine((d) => d.decision === "approve" || d.reason.length >= 3, {
    message: "Tell the educator why the claim is declined",
    path: ["reason"],
  });

const markPaidSchema = z.object({
  paymentReference: z.string().trim().max(120).optional().nullable(),
  paidAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date").optional().nullable(),
});

const settingsSchema = z.object({
  sessionRate: z.coerce.number().positive("The session rate must be more than 0").max(1000000),
  advancePercent: z.coerce.number().int().min(0, "Between 0 and 100").max(100, "Between 0 and 100"),
});

const createSupervisorSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(150),
  email: z.string().trim().email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

// Renaming, or setting a new password — either or both.
const updateSupervisorSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(150).optional(),
  password: z.string().min(8, "Password must be at least 8 characters").optional(),
});

module.exports = {
  createSupervisorSchema, updateSupervisorSchema, submitClaimSchema, decisionSchema, markPaidSchema, settingsSchema, CLAIM_TYPES, CLAIM_STATUSES };
