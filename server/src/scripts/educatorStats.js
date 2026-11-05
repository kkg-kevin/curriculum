// Refreshes every educator's profile figures (modules/educator-profiles/educator-profile.stats.js) —
// hours, sessions, learners, courses, parent ratings, QA, reliability, feedback speed. Run nightly from
// cron: `npm run educators:stats`. Profiles also refresh themselves when opened with figures older
// than 6 hours, so this only keeps them (and Find a mentor) quick.
require("dotenv").config({ quiet: true });
const db = require("../config/db");
const { refreshAll } = require("../modules/educator-profiles/educator-profile.stats");

refreshAll()
  .then((r) => { console.log(`[educator-stats] refreshed ${r.refreshed} of ${r.educators} educators`); return db.destroy(); })
  .catch((err) => { console.error("[educator-stats] failed:", err); process.exit(1); });
