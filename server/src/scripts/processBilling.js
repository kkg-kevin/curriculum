// Keeps part payments current, then exits.
//   npm run billing:process
//
// For every invoice still owed something: marks it overdue (or not any more), sends payment
// reminders (a few days before a part is due, on the day, the day after, when the grace days run
// out — each once), and pauses a family's learner accounts when a payment is overdue past the grace
// days (when the workspace has that on), switching them back on once it's paid. See
// modules/billing/billing.process.js. Safe to run again — nothing is sent twice. Run it from a cron
// job, hourly (cPanel → Cron Jobs), from the server's application root.
require("dotenv").config({ quiet: true });

const db = require("../config/db");
const { processPartPayments } = require("../modules/billing/billing.process");

(async () => {
  const counts = await processPartPayments();
  console.log("Part payments:", JSON.stringify(counts));
})()
  .catch((err) => {
    console.error("Part payments processing failed:", err);
    process.exitCode = 1;
  })
  // Leaves a moment for queued emails to go out before the pool closes.
  .finally(() => setTimeout(() => db.destroy(), 3000));
