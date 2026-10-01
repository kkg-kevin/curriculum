const db = require("../../config/db");
const { createRecord, firstOrNull } = require("../utils/model.utils");

const TABLE = "email_outbox";

// A row stuck in "sending" this long means the process died mid-send — it's picked up again.
const STALE_SENDING_MS = 15 * 60 * 1000;

// The email outbox — see 20261003090000_create_email_outbox_and_password_resets.js.
const EmailOutboxModel = {
  create(data) {
    return createRecord(db, TABLE, data);
  },

  findById(id) {
    return firstOrNull(db(TABLE).where({ id }));
  },

  findByDedupeKey(dedupeKey) {
    return firstOrNull(db(TABLE).where({ dedupeKey }));
  },

  update(id, patch) {
    return db(TABLE).where({ id }).update({ ...patch, updatedAt: new Date() });
  },

  // Takes a row for sending. Only one caller can win — the in-process sender and the cron
  // script may both be looking at the same row. Returns whether this caller got it.
  async claim(id) {
    const now = new Date();
    const count = await db(TABLE)
      .where({ id })
      .where((q) => {
        q.whereIn("status", ["pending", "failed"])
          .orWhere((stale) => stale.where({ status: "sending" }).where("updatedAt", "<", new Date(now.getTime() - STALE_SENDING_MS)));
      })
      .update({ status: "sending", updatedAt: now });
    return count > 0;
  },

  // Rows ready to send now: never tried, due for a retry, or abandoned mid-send.
  findDue(limit = 20) {
    const now = new Date();
    return db(TABLE)
      .where({ status: "pending" })
      .orWhere((q) => q.where({ status: "failed" }).where("nextAttemptAt", "<=", now))
      .orWhere((q) => q.where({ status: "sending" }).where("updatedAt", "<", new Date(now.getTime() - STALE_SENDING_MS)))
      .orderBy("createdAt", "asc")
      .limit(limit)
      .select("id");
  },
};

module.exports = EmailOutboxModel;
