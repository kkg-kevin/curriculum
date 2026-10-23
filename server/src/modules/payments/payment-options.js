const crypto = require("crypto");
const db = require("../../config/db");
const { toJson } = require("../../shared/utils/model.utils");
const { paymentInstructions, invoiceOwnerId } = require("./mpesa/mpesa.instructions");
const MpesaAccounts = require("./mpesa/mpesa.accounts");
const { isConfigured } = require("./mpesa/mpesa.config");
const { paymentCodeFor } = require("./mpesa/mpesa.utils");

// How a workspace's families can pay (Settings → Payments → "How families can pay"): M-Pesa
// Paybill, M-Pesa Send Money, bank transfer, cheque and cash, each switched on or off with the
// details a family needs. The website's Payment step after a sign-up shows the ones switched on
// for the invoice's workspace (forInvoice), and the family says "I've paid" through
// payment-notices.service.js.
//
// The Paybill is special: when the workspace's M-Pesa (Daraja) is set up, its number comes from
// there and payments to it go onto the invoice by themselves; until then the number typed here is
// shown and the family types in their M-Pesa code like any other method.

const TABLE = "payment_options";

// Every method a family can choose. `paymentMethod` is what a confirmed payment is recorded as
// (billing_payments.paymentMethod); `mpesa` methods take an M-Pesa transaction code.
const METHODS = {
  paybill: { label: "M-Pesa Paybill", paymentMethod: "mpesa_manual", mpesa: true },
  send_money: { label: "M-Pesa Send Money", paymentMethod: "mpesa_manual", mpesa: true },
  bank_transfer: { label: "Bank transfer", paymentMethod: "bank_transfer", mpesa: false },
  cheque: { label: "Cheque", paymentMethod: "cheque", mpesa: false },
  cash: { label: "Cash", paymentMethod: "cash", mpesa: false },
};

// A workspace that hasn't set anything up takes cash only — what sign-ups said before.
const DEFAULTS = {
  paybill: { enabled: false, number: "", accountName: "" },
  sendMoney: { enabled: false, phone: "", name: "" },
  bank: { enabled: false, bankName: "", accountName: "", accountNumber: "", branch: "", instructions: "" },
  cheque: { enabled: false, payableTo: "", instructions: "" },
  cash: { enabled: true, instructions: "Pay in cash at your learning hub or to our team, and ask for a receipt." },
  // How a website Store order reaches the family (orders.service.js): collected at one of the
  // workspace's in-person hubs, and/or delivered for a flat fee.
  pickup: { enabled: true, note: "" },
  delivery: { enabled: false, fee: 0, note: "" },
};

// Saved options over the defaults, field by field, so a method added later starts from its default.
function withDefaults(saved) {
  const options = saved && typeof saved === "object" ? saved : {};
  return Object.fromEntries(Object.entries(DEFAULTS).map(([key, value]) => [key, { ...value, ...(options[key] || {}) }]));
}

async function forOwner(ownerAdminId) {
  const row = ownerAdminId ? await db(TABLE).where({ ownerAdminId }).first() : null;
  return { options: withDefaults(row?.options), updatedAt: row?.updatedAt || null };
}

const PaymentOptions = {
  METHODS,
  forOwner,

  // Settings → Payments: what's saved, and whether this workspace's M-Pesa (Daraja) is live, which
  // decides where the Paybill number comes from.
  async get(req) {
    const saved = await forOwner(req.ownerAdminId);
    const account = await MpesaAccounts.forOwner(req.ownerAdminId);
    return { ...saved, mpesaLive: isConfigured(account) ? { paybill: account.shortcode } : null };
  },

  async save(req, options) {
    const existing = await db(TABLE).where({ ownerAdminId: req.ownerAdminId }).first();
    const patch = { options: toJson(withDefaults(options)), updatedBy: req.user.id, updatedAt: new Date() };
    if (existing) await db(TABLE).where({ id: existing.id }).update(patch);
    else await db(TABLE).insert({ ...patch, id: crypto.randomUUID(), ownerAdminId: req.ownerAdminId, createdAt: new Date() });
    return PaymentOptions.get(req);
  },

  // The ways this invoice can be paid, as the family sees them: only methods switched on and
  // filled in, each with what to pay to and the reference to use (the invoice's account number
  // for the Paybill, the invoice number everywhere else). `prompt` says the phone prompt works.
  async forInvoice(invoice) {
    const { options } = await forOwner(await invoiceOwnerId(invoice));
    const live = await paymentInstructions(invoice).catch(() => null);
    const account = paymentCodeFor(invoice.invoiceNumber);
    const methods = [];
    if (live) {
      methods.push({ key: "paybill", label: METHODS.paybill.label, paybill: live.paybill, account: live.account, accountName: live.accountLabel || options.paybill.accountName || null, prompt: true, automatic: true });
    } else if (options.paybill.enabled && options.paybill.number && account) {
      methods.push({ key: "paybill", label: METHODS.paybill.label, paybill: options.paybill.number, account, accountName: options.paybill.accountName || null, prompt: false, automatic: false });
    }
    if (options.sendMoney.enabled && options.sendMoney.phone) {
      methods.push({ key: "send_money", label: METHODS.send_money.label, phone: options.sendMoney.phone, name: options.sendMoney.name || null });
    }
    const bank = options.bank;
    if (bank.enabled && bank.bankName && bank.accountNumber) {
      methods.push({ key: "bank_transfer", label: METHODS.bank_transfer.label, bankName: bank.bankName, accountName: bank.accountName || null, accountNumber: bank.accountNumber, branch: bank.branch || null, instructions: bank.instructions || null, reference: invoice.invoiceNumber });
    }
    if (options.cheque.enabled && options.cheque.payableTo) {
      methods.push({ key: "cheque", label: METHODS.cheque.label, payableTo: options.cheque.payableTo, instructions: options.cheque.instructions || null, reference: invoice.invoiceNumber });
    }
    if (options.cash.enabled) {
      methods.push({ key: "cash", label: METHODS.cash.label, instructions: options.cash.instructions || null });
    }
    return methods;
  },
};

module.exports = PaymentOptions;
module.exports._internal = { withDefaults, DEFAULTS };
