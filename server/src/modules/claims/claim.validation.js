const { z } = require("zod");

const CLAIM_TYPES = ["advance", "full"];
// What a part-time educator can be paid on — the workspace sets the rates (Settings → Educator
// pay) and an educator is tagged with the ones that apply to them. "base_plus" is its own session
// rate plus a commission for each learner enrolled in the class, every session.
const RATE_TYPES = ["session", "hourly", "daily", "base_plus"];
const CLAIM_STATUSES = ["pending_supervisor", "pending_admin", "approved", "paid", "rejected"];

// The eTIMS invoice is uploaded first (POST /api/uploads/document) and only its stored path is
// sent here — so it has to be one of our own upload paths, and a PDF. The claim's own invoice is
// generated from its figures (client/src/modules/claims/invoicePdf.js); both go with every claim.
const submitClaimSchema = z.object({
  classId: z.string().min(1, "Class is required"),
  courseId: z.string().min(1, "Course is required"),
  type: z.enum(CLAIM_TYPES, { message: "Choose an advance or the full payment" }),
  // Left out by an older portal, which only knew per-session pay.
  rateType: z.enum(RATE_TYPES, { message: "Choose how this claim is worked out" }).optional().default("session"),
  invoiceUrl: z.string({ error: "Upload your eTIMS invoice as a PDF" }).regex(/^\/uploads\/[A-Za-z0-9-]+\.pdf$/i, "Upload your eTIMS invoice as a PDF"),
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

// Each part-time rate is optional — empty means that way of paying isn't offered — but at least
// one has to be set, or no part-time educator could claim at all.
const rate = (what) => z.preprocess(
  (v) => (v === "" || v === undefined ? null : v),
  z.coerce.number().positive(`The ${what} rate must be more than 0`).max(1000000).nullable(),
);
const settingsSchema = z
  .object({
    sessionRate: rate("session"),
    hourlyRate: rate("hourly"),
    dailyRate: rate("daily"),
    // Base plus: its own session rate (the base) and the commission per enrolled learner per
    // session — both set, or neither (not offered). The base is optional so an older screen saving
    // without it keeps what's stored.
    basePlusSessionRate: rate("Base plus session").optional(),
    commissionRate: rate("commission"),
    advancePercent: z.coerce.number().int().min(0, "Between 0 and 100").max(100, "Between 0 and 100"),
    // Course coverage needed before an advance: a % of the course's sessions OR a number of
    // delivered sessions, whichever comes first. 0 = not used. Optional so an older screen saving
    // without them keeps what's stored.
    advanceCoveragePercent: z.coerce.number().int("A whole number").min(0, "Between 0 and 100").max(100, "A coverage percentage is between 0 and 100").optional(),
    advanceCoverageSessions: z.coerce.number().int("A whole number").min(0, "Can't be below 0").max(1000).optional(),
  })
  .refine((d) => d.sessionRate || d.hourlyRate || d.dailyRate || (d.basePlusSessionRate && d.commissionRate), { message: "Set at least one part-time rate", path: ["sessionRate"] })
  .refine((d) => d.basePlusSessionRate === undefined || !d.commissionRate || d.basePlusSessionRate, { message: "Set the Base plus session rate too", path: ["basePlusSessionRate"] })
  .refine((d) => !d.basePlusSessionRate || d.commissionRate, { message: "Set the Base plus commission per learner too", path: ["commissionRate"] });

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
  createSupervisorSchema, updateSupervisorSchema, submitClaimSchema, decisionSchema, markPaidSchema, settingsSchema, CLAIM_TYPES, CLAIM_STATUSES, RATE_TYPES };
