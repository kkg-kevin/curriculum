const crypto = require("crypto");
const db = require("../../config/db");
const { createRecord, firstOrNull } = require("../../shared/utils/model.utils");

// A link that lets whoever holds it pay one invoice without signing in — the website's "Pay now"
// straight after a Home Learning, Tech Club or Bootcamp sign-up. It opens that one invoice's
// amount, the ways it can be paid and the payment notices sent for it, and lets the holder send an
// M-Pesa prompt or say "I've paid"; nothing else (no names, no other invoices). Only a SHA-256 of the token is stored, and it stops working after a few days.

const TABLE = "payment_links";
const DEFAULT_TTL_HOURS = 72;

const hash = (token) => crypto.createHash("sha256").update(String(token)).digest("hex");

const PaymentLinks = {
  // A new link for `invoiceId`. Returns the token — shown once, never stored.
  async issue(invoiceId, purpose, { ttlHours = DEFAULT_TTL_HOURS } = {}) {
    const token = crypto.randomBytes(24).toString("base64url");
    await createRecord(db, TABLE, {
      tokenHash: hash(token), invoiceId, purpose: String(purpose).slice(0, 40),
      expiresAt: new Date(Date.now() + ttlHours * 60 * 60 * 1000),
    }, { updatedAt: false });
    return token;
  },

  // The link behind a token, or an error a payer can read.
  async resolve(token) {
    if (!token || String(token).length < 20 || String(token).length > 100) throw Object.assign(new Error("This payment link isn't valid"), { statusCode: 404 });
    const link = await firstOrNull(db(TABLE).where({ tokenHash: hash(token) }));
    if (!link) throw Object.assign(new Error("This payment link isn't valid"), { statusCode: 404 });
    if (new Date(link.expiresAt).getTime() < Date.now()) {
      throw Object.assign(new Error("This payment link has expired. Sign in to pay from your account, or pay to the Paybill shown on your invoice."), { statusCode: 410 });
    }
    return link;
  },

  // What a website sign-up hands back for its Payment step: a link token, the ways this invoice
  // can be paid (payment-options.js), and — when the workspace's M-Pesa is live — the Paybill
  // details the phone prompt uses. Null when there's nothing to pay — and never throws, since the
  // sign-up itself has already succeeded.
  // `ttlHours` lets a Store order's link outlast a sign-up's (it's emailed, and paid later).
  async forWebsite(invoice, purpose, { ttlHours } = {}) {
    try {
      if (!invoice || !["issued", "partially_paid", "overdue"].includes(invoice.status)) return null;
      const PaymentOptions = require("./payment-options");
      const methods = await PaymentOptions.forInvoice(invoice);
      const paybill = methods.find((m) => m.key === "paybill");
      return {
        token: await PaymentLinks.issue(invoice.id, purpose, ttlHours ? { ttlHours } : undefined),
        methods,
        // Part payments: plans the family may choose instead of paying it all now (empty when off).
        plans: await require("../billing/billing.service").offeredPlans(invoice).catch(() => []),
        // The phone prompt (MpesaPayNow on the website) — only while Daraja is set up.
        ...(paybill?.prompt ? { paybill: paybill.paybill, account: paybill.account, accountLabel: paybill.accountName } : {}),
      };
    } catch (err) {
      console.error("[payments] couldn't make a payment link:", err.message);
      return null;
    }
  },

  touch(linkId) {
    return db(TABLE).where({ id: linkId }).update({ lastUsedAt: new Date() }).catch(() => {});
  },
};

module.exports = PaymentLinks;
