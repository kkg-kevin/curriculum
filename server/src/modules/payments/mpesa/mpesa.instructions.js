const db = require("../../../config/db");
const MpesaAccounts = require("./mpesa.accounts");
const { isConfigured } = require("./mpesa.config");
const { paymentCodeFor } = require("./mpesa.utils");

// How to pay an invoice by hand into the Paybill — "Paybill 123456, Account 2026000123" — for the
// invoice page, its PDF, the invoice email and the payment-pending screen. The Paybill is the
// invoice's workspace's own (Settings → Payments) or the installation's. Null when M-Pesa is off
// for it, the invoice isn't in shillings, or it has no real number yet (a draft). Kept apart from
// mpesa.service.js so billing can use it without requiring the service (which requires billing).

// The workspace an invoice belongs to: its hub's owner.
async function invoiceOwnerId(invoice) {
  if (!invoice?.hubId) return null;
  const hub = await db("learning_hubs").where({ id: invoice.hubId }).select("ownerAdminId").first();
  return hub?.ownerAdminId || null;
}

async function accountForInvoice(invoice) {
  return MpesaAccounts.forOwner(await invoiceOwnerId(invoice));
}

async function paymentInstructions(invoice) {
  const account = paymentCodeFor(invoice?.invoiceNumber) && (invoice.currency || "KES") === "KES" ? await accountForInvoice(invoice) : null;
  if (!account || !isConfigured(account)) return null;
  return { paybill: account.shortcode, account: paymentCodeFor(invoice.invoiceNumber), accountLabel: account.accountLabel, maxAmount: account.maxAmount };
}

module.exports = { paymentInstructions, accountForInvoice, invoiceOwnerId };
