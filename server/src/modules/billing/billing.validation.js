const { z } = require("zod");

const invoiceTypes = ["hub_subscription", "learner_term", "course_module", "bootcamp"];
const invoiceStatus = ["draft", "issued", "partially_paid", "paid", "overdue", "cancelled", "void"];

const invoiceItemSchema = z.object({
  description: z.string().trim().min(1).max(255),
  quantity: z.coerce.number().positive().default(1),
  unitAmount: z.coerce.number().nonnegative(),
  learnerId: z.string().optional().nullable(),
  courseId: z.string().optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional().nullable(),
});

const createInvoiceSchema = z.object({
  hubId: z.string().min(1),
  invoiceType: z.enum(invoiceTypes),
  classId: z.string().optional().nullable(),
  pricingMode: z.enum(["flat", "per_learner"]).optional().default("flat"),
  unitAmount: z.coerce.number().positive().optional().nullable(),
  learnerId: z.string().optional().nullable(),
  payerUserId: z.string().optional().nullable(),
  payerHubId: z.string().optional().nullable(),
  periodStart: z.string().optional().nullable(),
  periodEnd: z.string().optional().nullable(),
  periodLabel: z.string().max(100).optional().nullable(),
  dueAt: z.string().optional().nullable(),
  discount: z.coerce.number().nonnegative().default(0),
  notes: z.string().max(2000).optional().nullable(),
  items: z.array(invoiceItemSchema).min(1).max(100),
});

const updateInvoiceSchema = z.object({
  dueAt: z.string().optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  discount: z.coerce.number().nonnegative().optional(),
});

const recordPaymentSchema = z.object({
  amount: z.coerce.number().positive(),
  paymentMethod: z.string().max(40).default("manual"),
  providerReference: z.string().max(120).optional().nullable(),
  paymentDate: z.string().optional().nullable(),
  receiptNumber: z.string().max(50).optional().nullable(),
  notes: z.string().max(255).optional().nullable(),
});

const bulkInvoicePreviewSchema = z.object({
  hubId: z.string().min(1),
  scopeType: z.enum(["hub", "class", "learners"]),
  classId: z.string().optional().nullable(),
  learnerIds: z.array(z.string()).max(500).optional().default([]),
  invoiceType: z.enum(["learner_term", "course_module", "bootcamp"]),
  periodLabel: z.string().max(100).optional().nullable(),
});

const bulkInvoiceCreateSchema = bulkInvoicePreviewSchema.extend({
  description: z.string().trim().min(1).max(255),
  unitAmount: z.coerce.number().positive(),
  dueAt: z.string().optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

module.exports = { invoiceTypes, invoiceStatus, createInvoiceSchema, updateInvoiceSchema, recordPaymentSchema, bulkInvoicePreviewSchema, bulkInvoiceCreateSchema };
