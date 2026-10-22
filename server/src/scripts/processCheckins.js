// Keeps hub check-ins current, then exits.
//   npm run checkins:process
//
// For every workspace: puts each active schedule's upcoming sessions on the calendar, moves
// sessions whose day has passed to Missed / Pending submission (telling the people concerned),
// and sends the day-before and same-day reminders and overdue follow-up reminders. Every step is
// keyed, so running it again changes nothing and sends nothing twice. The pages do the same for
// their own workspace when opened; this is what makes reminders arrive without anyone opening
// them. Run it from a cron job — once an hour is plenty (cPanel → Cron Jobs), from the server's
// application root.
require("dotenv").config({ quiet: true });

const db = require("../config/db");
const CheckinService = require("../modules/checkins/checkin.service");

(async () => {
  await CheckinService.generateAll();
  const statusChanges = await CheckinService.refreshStatuses();
  const reminders = await CheckinService.sendReminders();
  console.log("Hub check-ins:", JSON.stringify({ statusChanges, remindersChecked: reminders }));
})()
  .catch((err) => {
    console.error("Hub check-ins processing failed:", err);
    process.exitCode = 1;
  })
  // Leaves a moment for queued emails to go out before the pool closes.
  .finally(() => setTimeout(() => db.destroy(), 3000));
