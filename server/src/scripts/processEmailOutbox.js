// Sends every email in the outbox that's waiting or due for a retry, then exits.
//   npm run mail:process
//
// The server already sends each email as it's queued and retries failures whenever another email
// goes out; this is the safety net for a quiet period or a restart mid-send. Run it from a cron
// job every 5–10 minutes (cPanel → Cron Jobs), from the server's application root.
require("dotenv").config();

const db = require("../config/db");
const { processOutbox } = require("../shared/mail/mail.service");

processOutbox({ limit: 200 })
  .then((handled) => {
    console.log(`Email outbox: handled ${handled} email(s).`);
  })
  .catch((err) => {
    console.error("Email outbox run failed:", err);
    process.exitCode = 1;
  })
  .finally(() => db.destroy());
