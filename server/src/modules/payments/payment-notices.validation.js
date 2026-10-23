const { z } = require("zod");
const { normalisePhone } = require("./mpesa/mpesa.utils");

const text = (max) => z.string().trim().max(max).optional().default("");
const kenyanPhone = (message) => z.string().trim().max(20).optional().default("")
  .refine((value) => !value || Boolean(normalisePhone(value)), message);

// Settings → Payments → "How families can pay". The whole object is sent on every save.
const paymentOptionsSchema = z.object({
  paybill: z.object({ enabled: z.boolean().default(false), number: z.string().trim().regex(/^\d{0,10}$/, "The Paybill number is digits only").default(""), accountName: text(100) }).prefault({}),
  sendMoney: z.object({ enabled: z.boolean().default(false), phone: kenyanPhone("Enter the Send Money number as a Kenyan mobile number, e.g. 0712 345 678"), name: text(100) }).prefault({}),
  bank: z.object({ enabled: z.boolean().default(false), bankName: text(100), accountName: text(150), accountNumber: text(40), branch: text(100), instructions: text(300) }).prefault({}),
  cheque: z.object({ enabled: z.boolean().default(false), payableTo: text(150), instructions: text(300) }).prefault({}),
  cash: z.object({ enabled: z.boolean().default(false), instructions: text(300) }).prefault({}),
  pickup: z.object({ enabled: z.boolean().default(true), note: text(300) }).prefault({}),
  delivery: z.object({ enabled: z.boolean().default(false), fee: z.coerce.number().min(0, "The delivery fee can't be below 0").max(1000000).default(0), note: text(300) }).prefault({}),
}).superRefine((options, ctx) => {
  const need = (on, value, path, message) => { if (on && !value) ctx.addIssue({ code: "custom", path, message }); };
  need(options.paybill.enabled, options.paybill.number, ["paybill", "number"], "Enter the Paybill number, or switch Paybill off");
  need(options.sendMoney.enabled, options.sendMoney.phone, ["sendMoney", "phone"], "Enter the Send Money number, or switch Send Money off");
  need(options.bank.enabled, options.bank.bankName, ["bank", "bankName"], "Enter the bank's name, or switch bank transfer off");
  need(options.bank.enabled, options.bank.accountNumber, ["bank", "accountNumber"], "Enter the bank account number, or switch bank transfer off");
  need(options.cheque.enabled, options.cheque.payableTo, ["cheque", "payableTo"], "Enter who cheques are payable to, or switch cheques off");
});

// A family saying "I've paid". `reference` is the M-Pesa code, the bank reference or the cheque
// number (the service checks which the method needs). Left out, `amount` is everything due.
const submitNoticeSchema = z.object({
  method: z.enum(["paybill", "send_money", "bank_transfer", "cheque", "cash"], { message: "Choose how you paid" }),
  reference: z.string().trim().max(60).optional().nullable(),
  amount: z.coerce.number().positive("Enter the amount you paid").max(10000000).optional().nullable(),
  phone: kenyanPhone("Enter the phone number as a Kenyan mobile number, e.g. 0712 345 678").nullable(),
  note: z.string().trim().max(500).optional().nullable(),
});

const noticeQuerySchema = z.object({
  status: z.enum(["pending", "confirmed", "rejected", "closed", "all"]).optional().default("pending"),
});

// Staff confirming a notice: the amount actually received (default: what the family said).
const confirmNoticeSchema = z.object({
  amount: z.coerce.number().positive("Enter the amount received").optional().nullable(),
  paymentDate: z.string().trim().max(30).optional().nullable(),
  note: z.string().trim().max(500).optional().nullable(),
});

const rejectNoticeSchema = z.object({
  reason: z.string().trim().min(3, "Say why, so the family knows what to do").max(500),
});

module.exports = { paymentOptionsSchema, submitNoticeSchema, noticeQuerySchema, confirmNoticeSchema, rejectNoticeSchema };
