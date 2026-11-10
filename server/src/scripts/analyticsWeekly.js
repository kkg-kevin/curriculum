// The weekly summary of Reports & Analytics (modules/analytics/analytics.weekly.js) — last week's
// key figures and "Needs your attention", to each workspace's admins and each hub's login. Run on
// Monday mornings from cron: `npm run analytics:weekly`. Safe to repeat: one email per person per
// week. Then run `npm run mail:process` (or let its own cron) send anything still queued.
require("dotenv").config({ quiet: true });
const db = require("../config/db");
const { runWeekly } = require("../modules/analytics/analytics.weekly");

runWeekly()
  .then(async (r) => {
    console.log(`[analytics-weekly] ${r.week.from} to ${r.week.to}: queued ${r.sent} summaries`);
    await new Promise((done) => setTimeout(done, 2000));
    return db.destroy();
  })
  .catch((err) => { console.error("[analytics-weekly] failed:", err); process.exit(1); });
