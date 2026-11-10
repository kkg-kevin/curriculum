// Refreshes every educator's profile figures (modules/educator-profiles/educator-profile.stats.js) —
// hours, sessions, learners, courses, parent ratings, QA, reliability, feedback speed. Run nightly from
// cron: `npm run educators:stats`. Profiles also refresh themselves when opened with figures older
// than 6 hours, so this only keeps them (and Find a mentor) quick. Then each mentor's standing against
// the workspace's mentor standards is kept for the month, and anyone newly below one is flagged to
// their supervisor (modules/mentor-standards/).
require("dotenv").config({ quiet: true });
const db = require("../config/db");
const { refreshAll } = require("../modules/educator-profiles/educator-profile.stats");
const MentorStandardsService = require("../modules/mentor-standards/mentor-standards.service");

refreshAll()
  .then(async (r) => {
    console.log(`[educator-stats] refreshed ${r.refreshed} of ${r.educators} educators`);
    const s = await MentorStandardsService.runAll();
    console.log(`[mentor-standards] kept this month's standing for ${s.snapshotted} of ${s.mentors} mentors`);
    // A moment for queued emails before the pool closes.
    await new Promise((done) => setTimeout(done, 2000));
    return db.destroy();
  })
  .catch((err) => { console.error("[educator-stats] failed:", err); process.exit(1); });
