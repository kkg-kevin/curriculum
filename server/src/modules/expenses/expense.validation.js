const { z } = require("zod");
const { PAYMENT_METHODS } = require("./expense.rules");
const { TYPE_KEYS, GENERAL } = require("./expense.links");

// Every schema here is a whole object (never `.partial()` — in Zod 4 that fills defaults in and
// would wipe fields on a save).

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date like 2026-11-18");
const text = (max) => z.string().trim().max(max);
const optionalText = (max) => z.union([text(max), z.null()]).optional().transform((v) => (v ? v : null));

const itemSchema = z.object({
  id: z.string().max(36).optional().nullable(),
  // The form's own key for a line not yet saved — returned so the client can match lines up.
  clientKey: z.string().max(60).optional().nullable(),
  spentOn: day,
  category: text(40).min(1, "Choose a category"),
  description: text(500).min(1, "Say what the expense was for"),
  vendor: optionalText(200),
  amount: z.coerce.number({ error: "Give an amount" }).positive("Every amount must be above 0").max(10000000),
  mpesaCode: optionalText(30),
  noReceiptReason: optionalText(500),
  // What it was for (expense.links.js): a kind of record and its id, or "general".
  linkType: z.union([z.enum([...TYPE_KEYS, GENERAL]), z.null()]).optional().transform((v) => v || null),
  linkId: z.union([z.string().max(36), z.null()]).optional().transform((v) => v || null),
  fileIds: z.array(z.string().max(36)).max(10, "Up to 10 files per expense").default([]),
});

const claimSchema = z.object({
  title: text(200).min(1, "Give the claim a title, e.g. \"Visit to Brookhouse, 18 Nov\""),
  purpose: optionalText(4000),
  hubId: z.union([z.string().max(36), z.null()]).optional().transform((v) => v || null),
  items: z.array(itemSchema).min(1, "Add at least one expense").max(60),
});

const decisionSchema = z.object({
  decision: z.enum(["approve", "return", "reject"]),
  reason: optionalText(2000),
  lines: z.array(z.object({ id: z.string().max(36), rejected: z.boolean(), reason: optionalText(500) })).max(60).default([]),
}).superRefine((v, ctx) => {
  if ((v.decision === "return" || v.decision === "reject") && !v.reason) {
    ctx.addIssue({ code: "custom", path: ["reason"], message: v.decision === "return" ? "Say what needs changing" : "Give a reason for declining" });
  }
  for (const line of v.lines) {
    if (line.rejected && !line.reason) ctx.addIssue({ code: "custom", path: ["lines"], message: "Give a reason for every expense you turn down" });
  }
});

const paySchema = z.object({
  method: z.enum(PAYMENT_METHODS),
  reference: optionalText(120),
  paidAt: day.optional().nullable(),
  note: optionalText(1000),
});

const settingsSchema = z.object({
  categories: z.array(z.object({
    key: z.string().trim().min(1).max(40).regex(/^[a-z0-9_-]+$/, "Category keys are lower-case letters, numbers, - and _"),
    label: text(80).min(1, "Name every category"),
    active: z.boolean().default(true),
  })).min(1, "Keep at least one category").max(40),
  requireLink: z.boolean().optional().default(false),
});

const linkQuerySchema = z.object({ type: z.enum(TYPE_KEYS), q: z.string().max(100).optional().default("") });
const linkedQuerySchema = z.object({ type: z.enum(TYPE_KEYS), id: z.string().min(1).max(36) });
const byLinkQuerySchema = z.object({ from: day.optional(), to: day.optional() });

module.exports = { claimSchema, decisionSchema, paySchema, settingsSchema, linkQuerySchema, linkedQuerySchema, byLinkQuerySchema };
