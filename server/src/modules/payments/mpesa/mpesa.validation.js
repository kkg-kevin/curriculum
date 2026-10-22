const { z } = require("zod");

// Pay with M-Pesa / Request payment / Pay now. `amount` is optional: left out, the prompt asks for
// everything that's due.
const initiateSchema = z.object({
  phone: z.string().trim().min(9, "Enter the phone number to send the prompt to").max(20),
  amount: z.coerce.number().int("M-Pesa takes whole shillings — enter an amount without cents").positive().optional().nullable(),
});

const transactionQuerySchema = z.object({
  status: z.enum(["unallocated", "partially_allocated", "allocated", "ignored", "reversed"]).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

// The invoice number (INV-2026-000123) or its payment code (2026000123).
const allocateSchema = z.object({
  invoice: z.string().trim().min(4, "Enter the invoice number").max(40),
});

const ignoreSchema = z.object({
  note: z.string().trim().max(255).optional().nullable(),
});

const reverseSchema = z.object({
  note: z.string().trim().max(100).optional().nullable(),
});

// Paying an educator's claim. `amount` is the amount the admin was shown and confirmed.
const payoutSchema = z.object({
  phone: z.string().trim().max(20).optional().nullable(),
  amount: z.coerce.number().positive("Confirm the amount"),
  confirmUnknown: z.boolean().optional(),
});

// Settings → Payments. A secret left out (or empty) keeps what's saved; null clears it.
const secret = z.string().trim().max(4000).optional().nullable();
const accountSchema = z.object({
  enabled: z.boolean(),
  environment: z.enum(["sandbox", "production"]),
  shortcode: z.string().trim().regex(/^\d{5,10}$/, "Enter the Paybill number (digits only)"),
  accountLabel: z.string().trim().max(100).optional().nullable(),
  consumerKey: secret,
  consumerSecret: secret,
  passkey: secret,
  initiatorName: z.string().trim().max(100).optional().nullable(),
  securityCredential: secret,
  b2cShortcode: z.string().trim().regex(/^(\d{5,10})?$/, "Enter the B2C shortcode (digits only)").optional().nullable(),
  b2cConsumerKey: secret,
  b2cConsumerSecret: secret,
  b2cInitiatorName: z.string().trim().max(100).optional().nullable(),
  b2cSecurityCredential: secret,
});

module.exports = { initiateSchema, transactionQuerySchema, allocateSchema, ignoreSchema, reverseSchema, payoutSchema, accountSchema };
