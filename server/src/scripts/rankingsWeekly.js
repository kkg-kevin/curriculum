// The weekly round of class rankings (modules/rankings/ranking.weekly.js): ranks every class
// afresh, awards new badges, and sends each learner's family "moved up" and the week's summary.
// Run on Monday mornings from cron: `npm run rankings:weekly`. Safe to repeat: one notice per
// learner per class per week. Then `npm run mail:process` (or its own cron) sends the emails.
require("dotenv").config({ quiet: true });
const db = require("../config/db");
const { runWeekly } = require("../modules/rankings/ranking.weekly");

runWeekly()
  .then(async (r) => {
    console.log(`[rankings-weekly] week of ${r.week}: ${r.classes} classes, ${r.movedUp} moved up, ${r.summaries} summaries`);
    await new Promise((done) => setTimeout(done, 2000));
    return db.destroy();
  })
  .catch((err) => { console.error("[rankings-weekly] failed:", err); process.exit(1); });
