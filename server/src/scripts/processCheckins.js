// Keeps hub check-ins current, then exits.
//   npm run checkins:process
//
// For every workspace: puts each active schedule's upcoming check-ins on the calendar, and sends
// "Check-in due today" to the Account Manager and Training Lead of each one whose day it is, and
// "task due" to whoever has a check-in task whose deadline has come. Every
// step is keyed, so running it again changes nothing and sends nothing twice. The pages do the same
// for their own workspace when opened; this is what makes the notice arrive without anyone opening
// them. Run it from a cron job — once an hour is plenty (cPanel → Cron Jobs), from the server's
// application root.
require("dotenv").config({ quiet: true });

const db = require("../config/db");
const CheckinService = require("../modules/checkins/checkin.service");

(async () => {
  const schedules = await CheckinService.generateAll();
  const dueToday = await CheckinService.sendDueNotices();
  const tasksDue = await CheckinService.sendTaskDueNotices();
  console.log("Hub check-ins:", JSON.stringify({ schedules, dueToday, tasksDue }));
})()
  .catch((err) => {
    console.error("Hub check-ins processing failed:", err);
    process.exitCode = 1;
  })
  // Leaves a moment for queued emails to go out before the pool closes.
  .finally(() => setTimeout(() => db.destroy(), 3000));
