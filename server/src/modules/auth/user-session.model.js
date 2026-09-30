const db = require("../../config/db");
const { firstOrNull } = require("../../shared/utils/model.utils");

const TABLE = "user_sessions";

// Signed-in sessions, keyed by the JWT's `jti` — see 20261002100000_create_user_sessions.js.
const UserSessionModel = {
  async create({ jti, userId, expiresAt }) {
    const now = new Date();
    const record = { jti, userId, lastActivityAt: now, expiresAt, createdAt: now };
    await db(TABLE).insert(record);
    return record;
  },

  findByJti(jti) {
    return firstOrNull(db(TABLE).where({ jti }));
  },

  touch(jti) {
    return db(TABLE).where({ jti }).update({ lastActivityAt: new Date() });
  },

  delete(jti) {
    return db(TABLE).where({ jti }).del();
  },

  // Sessions whose token has expired, or that have been idle past the limit, are dead weight —
  // `protect` would refuse them anyway. Pruned opportunistically on login/logout, like
  // RevokedTokenModel.pruneExpired, rather than by a separate cron.
  pruneStale(idleMinutes) {
    const idleCutoff = new Date(Date.now() - idleMinutes * 60 * 1000);
    return db(TABLE).where("expiresAt", "<", new Date()).orWhere("lastActivityAt", "<", idleCutoff).del();
  },
};

module.exports = UserSessionModel;
