// What a payment switches on. Called by BillingService.applyPayment after the payment has been
// saved, whoever or whatever paid (staff recording a payment, an M-Pesa prompt, money sent straight
// to the Paybill, a confirmed "I've paid").
//
// Part payments (28 Oct 2026): a website sign-up's first invoice switches the sign-up on as soon as
// enough of it is paid — any payment, unless the workspace's partPayments.minimumPercent asks for a
// share (runInvoiceActivationHooks) — the same thing an admin's "Approve" / "Mark paid" does, so a
// family who pays by M-Pesa doesn't wait for anyone. Placing the children (curriculum, class,
// educator) stays the admin's job, as before. A Store order still ships only once fully paid, and
// "I've paid" notices close then too (runInvoicePaidHooks). Each hook acts once — it does nothing
// for a sign-up already switched on — so running them on every payment is safe.
//
// The modules are required when needed, not at the top: each of them requires billing.service.js.
// A hook that fails is logged and never undoes the payment.
async function runHooks(invoice, hooks) {
  for (const hook of hooks) {
    try {
      await hook();
    } catch (err) {
      console.error(`[billing] a payment was recorded on invoice ${invoice.invoiceNumber}, but switching on what it pays for failed:`, err.message);
    }
  }
}

// Enough of the invoice is paid to switch its sign-up on.
function runInvoiceActivationHooks(invoice, { amount = null, paidByUserId = null } = {}) {
  return runHooks(invoice, [
    () => require("../home-learning/home-learning-signup.service").activateForPaidInvoice(invoice, { amount, paidByUserId }),
    () => require("../tech-clubs/club-signup.service").activateForPaidInvoice(invoice, { amount, paidByUserId }),
    () => require("../bootcamp-enrollment/bootcamp-enrollment.service").activateForPaidInvoice(invoice, { amount, paidByUserId }),
  ]);
}

// The invoice is paid in full.
function runInvoicePaidHooks(invoice) {
  return runHooks(invoice, [
    () => require("../orders/orders.service").activateForPaidInvoice(invoice),
    // "I've paid" notices still waiting on it have nothing left to confirm.
    () => require("../payments/payment-notices.service").closeForPaidInvoice(invoice),
  ]);
}

module.exports = { runInvoiceActivationHooks, runInvoicePaidHooks };
