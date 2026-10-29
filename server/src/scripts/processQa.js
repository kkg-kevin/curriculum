// Keeps quality assurance visits current, then exits.
//   npm run qa:process
//
// For every workspace: puts each active schedule's upcoming visits on the calendar, tells educators
// about announced visits in the coming week, and tells reviewers about visits due today. Every step
// is keyed, so running it again changes nothing and sends nothing twice. The pages do the same for
// their own workspace when opened; this is what makes the notices arrive without anyone opening
// them. Run it from a cron job — once an hour is plenty (cPanel → Cron Jobs), from the server's
// application root.
require("dotenv").config({ quiet: true });

const db = require("../config/db");
const QaService = require("../modules/qa/qa.service");

(async () => {
  const schedules = await QaService.generateAll();
  const notices = await QaService.sendNotices();
  console.log("Quality assurance:", JSON.stringify({ schedules, ...notices }));
})()
  .catch((err) => {
    console.error("Quality assurance processing failed:", err);
    process.exitCode = 1;
  })
  // Leaves a moment for queued emails to go out before the pool closes.
  .finally(() => setTimeout(() => db.destroy(), 3000));
