// Checks M-Pesa payment prompts that never heard back from Safaricom, then exits.
//   npm run mpesa:reconcile
//
// Safaricom normally calls back within seconds of the payer entering their PIN, but now and then
// a callback is lost. This asks Safaricom about every prompt still pending after a minute: paid
// ones are put on their invoice, others are marked failed, and ones still unanswered after 15
// minutes are marked timed out. Educator payouts, status checks and reversals that Safaricom never
// answered are marked timed out after a day. Run it from a cron job every 5 minutes (cPanel → Cron
// Jobs), from the server's application root. Does nothing while M-Pesa isn't configured.
require("dotenv").config({ quiet: true });

const db = require("../config/db");
const MpesaService = require("../modules/payments/mpesa/mpesa.service");

MpesaService.reconcile({ limit: 200 })
  .then((counts) => {
    console.log("M-Pesa reconcile:", JSON.stringify(counts));
  })
  .catch((err) => {
    console.error("M-Pesa reconcile failed:", err);
    process.exitCode = 1;
  })
  // Leaves a moment for receipt emails queued by a payment to go out before the pool closes.
  .finally(() => setTimeout(() => db.destroy(), 3000));
