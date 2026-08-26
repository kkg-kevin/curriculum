const { z } = require("zod");
const { invoiceTypes } = require("../../billing/billing.validation");

const createItemSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(150),
  description: z.string().trim().max(500).optional().nullable(),
  defaultPrice: z.coerce.number().nonnegative().optional().nullable(),
  unit: z.string().trim().min(1).max(30).optional().default("item"),
  invoiceType: z.enum(invoiceTypes).optional().nullable(),
});

const updateItemSchema = createItemSchema.partial();

module.exports = { createItemSchema, updateItemSchema };
