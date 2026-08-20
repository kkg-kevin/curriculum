const db = require("../../config/db");
const { firstOrNull } = require("../../shared/utils/model.utils");

const TABLE = "revoked_tokens";

// Keyed by the JWT's own `jti` claim, not a generated id — every read/write here is by jti.
const RevokedTokenModel = {
  async create({ jti, userId, expiresAt }) {
    const record = { jti, userId: userId || null, expiresAt, createdAt: new Date() };
    await db(TABLE).insert(record);
    return record;
  },

  async isRevoked(jti) {
    return !!(await firstOrNull(db(TABLE).where({ jti })));
  },

  // Rows past their own expiresAt are dead weight — the JWT they refer to would already fail
  // jwt.verify()'s own exp check, so nothing still needs them in the denylist. Run opportunistically
  // on logout (see AuthService.logout) instead of a separate cron — this table only grows by one
  // row per logout, so an occasional bulk delete alongside that is enough to keep it bounded.
  pruneExpired() {
    return db(TABLE).where("expiresAt", "<", new Date()).del();
  },
};

module.exports = RevokedTokenModel;
