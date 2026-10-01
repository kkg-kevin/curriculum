const db = require("../../config/db");
const { createRecord, firstOrNull } = require("../../shared/utils/model.utils");

const TABLE = "password_reset_tokens";

// Emailed password-reset links — see 20261003090000_create_email_outbox_and_password_resets.js.
// Only the token's hash is ever stored or looked up.
const PasswordResetTokenModel = {
  create({ userId, tokenHash, expiresAt }) {
    return createRecord(db, TABLE, { userId, tokenHash, expiresAt }, { updatedAt: false });
  },

  findByHash(tokenHash) {
    return firstOrNull(db(TABLE).where({ tokenHash }));
  },

  countRecentForUser(userId, since) {
    return db(TABLE).where({ userId }).where("createdAt", ">=", since).count({ count: "*" }).first()
      .then((row) => Number(row.count));
  },

  // Once a password has been reset, every other outstanding link for that account is dead too.
  markAllUsedForUser(userId) {
    return db(TABLE).where({ userId }).whereNull("usedAt").update({ usedAt: new Date() });
  },

  // Pruned opportunistically when a reset is requested, like RevokedTokenModel.pruneExpired.
  pruneExpired() {
    return db(TABLE).where("expiresAt", "<", new Date(Date.now() - 24 * 60 * 60 * 1000)).del();
  },
};

module.exports = PasswordResetTokenModel;
