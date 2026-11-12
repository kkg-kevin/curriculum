// General events: reminders and the "say thank you" nudge, then exits.
//   npm run events:process
//
// Emails everyone registered for an event two days before (one, for someone who registered the day
// before) and on the morning of the day; the day after an event, tells its workspace's admins how
// many came, so they send a thank-you. Every send is keyed, so running it again sends nothing
// twice. `npm run checkins:process` (hourly) already runs this too — schedule this on its own only
// on an installation that doesn't run that one.
require("dotenv").config({ quiet: true });

const db = require("../config/db");
const GeneralEventService = require("../modules/general-events/general-event.service");

(async () => {
  console.log("General events:", JSON.stringify(await GeneralEventService.processAll()));
})()
  .catch((err) => {
    console.error("General events processing failed:", err);
    process.exitCode = 1;
  })
  // Leaves a moment for queued emails to go out before the pool closes.
  .finally(() => setTimeout(() => db.destroy(), 3000));
