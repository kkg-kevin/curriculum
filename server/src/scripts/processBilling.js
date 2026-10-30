// Raises package invoices that are due, then keeps part payments current, and exits.
//   npm run billing:process
//
// First, every active Home Learning household and Tech Club membership gets the invoice for each
// billing period that has started (a daily package's for each month that has ended) — see
// modules/billing/package-billing.js. Then, for every invoice still owed something: marks it overdue (or not any more), sends payment
// reminders (a few days before a part is due, on the day, the day after, when the grace days run
// out — each once), and pauses a family's learner accounts when a payment is overdue past the grace
// days (when the workspace has that on), switching them back on once it's paid. See
// modules/billing/billing.process.js. Safe to run again — nothing is sent twice. Run it from a cron
// job, hourly (cPanel → Cron Jobs), from the server's application root.
require("dotenv").config({ quiet: true });

const db = require("../config/db");
const { processPartPayments } = require("../modules/billing/billing.process");
const { processPackageBilling } = require("../modules/billing/package-billing");

(async () => {
  console.log("Package invoices:", JSON.stringify(await processPackageBilling()));
  const counts = await processPartPayments();
  console.log("Part payments:", JSON.stringify(counts));
})()
  .catch((err) => {
    console.error("Part payments processing failed:", err);
    process.exitCode = 1;
  })
  // Leaves a moment for queued emails to go out before the pool closes.
  .finally(() => setTimeout(() => db.destroy(), 3000));
