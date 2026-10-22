// What happens when an invoice becomes fully paid, whoever or whatever paid it (staff recording a
// payment, an M-Pesa prompt, money sent straight to the Paybill). Called by
// BillingService.applyPayment after the payment has been saved.
//
// A website sign-up's first invoice switches the sign-up on — the same thing an admin's
// "Approve" / "Mark paid" button does — so a family who pays by M-Pesa doesn't wait for anyone.
// Placing the children (curriculum, class, educator) stays the admin's job, as before.
//
// The modules are required when needed, not at the top: each of them requires billing.service.js.
// A hook that fails is logged and never undoes the payment.
async function runInvoicePaidHooks(invoice, { amount = null, paidByUserId = null } = {}) {
  const hooks = [
    () => require("../home-learning/home-learning-signup.service").activateForPaidInvoice(invoice, { amount, paidByUserId }),
    () => require("../tech-clubs/club-signup.service").activateForPaidInvoice(invoice, { amount, paidByUserId }),
    () => require("../bootcamp-enrollment/bootcamp-enrollment.service").activateForPaidInvoice(invoice, { amount, paidByUserId }),
  ];
  for (const hook of hooks) {
    try {
      await hook();
    } catch (err) {
      console.error(`[billing] invoice ${invoice.invoiceNumber} was paid, but switching on what it pays for failed:`, err.message);
    }
  }
}

module.exports = { runInvoicePaidHooks };
