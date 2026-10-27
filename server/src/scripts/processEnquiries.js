// Enquiry housekeeping, then exits.
//   npm run enquiries:process
//
// The daily reminder about enquiries still New, closing enquiries nobody has touched for a long
// time, and (when switched on) removing the personal details of old closed ones — Settings →
// Enquiries decides each. See modules/leads/lead.housekeeping.js. Safe to run again: the reminder
// goes out once a day. Run it from a cron job once a day, in the morning (cPanel → Cron Jobs), from
// the server's application root.
require("dotenv").config({ quiet: true });

const db = require("../config/db");
const { processEnquiries } = require("../modules/leads/lead.housekeeping");

(async () => {
  const counts = await processEnquiries();
  console.log("Enquiries:", JSON.stringify(counts));
})()
  .catch((err) => {
    console.error("Enquiry housekeeping failed:", err);
    process.exitCode = 1;
  })
  // Leaves a moment for queued emails to go out before the pool closes.
  .finally(() => setTimeout(() => db.destroy(), 3000));
