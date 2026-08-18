const db = require("../../config/db");
const {
  createRecord,
  firstOrNull,
  stringifyJsonFields,
} = require("../../shared/utils/model.utils");

const TABLE = "notifications";
const JSON_FIELDS = ["payload"];

const NotificationModel = {
  create(data) {
    return createRecord(db, TABLE, stringifyJsonFields(data, JSON_FIELDS));
  },

  findOne({ recipientId, dedupeKey }) {
    return firstOrNull(db(TABLE).where({ recipientId, dedupeKey }));
  },

  // Most-recent-first, capped — a notification feed, not a full audit log; nothing in this
  // codebase currently needs to page back through old ones.
  findForRecipient(recipientId, { limit = 30 } = {}) {
    return db(TABLE).where({ recipientId }).orderBy("createdAt", "desc").limit(limit);
  },

  countUnread(recipientId) {
    return db(TABLE).where({ recipientId, isRead: false }).count({ count: "*" }).first()
      .then((row) => Number(row.count));
  },

  async markRead(id, recipientId) {
    const count = await db(TABLE).where({ id, recipientId }).update({ isRead: true, updatedAt: new Date() });
    if (count === 0) return null;
    return firstOrNull(db(TABLE).where({ id }));
  },

  markAllRead(recipientId) {
    return db(TABLE).where({ recipientId, isRead: false }).update({ isRead: true, updatedAt: new Date() });
  },
};

module.exports = NotificationModel;
