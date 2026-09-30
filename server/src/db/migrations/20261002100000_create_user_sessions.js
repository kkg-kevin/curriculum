const { fk } = require("../helpers");

// One row per signed-in session, keyed by the JWT's own `jti` (same key revoked_tokens uses).
// Exists for the idle timeout: `protect` ends a session once lastActivityAt is more than
// SESSION_IDLE_MINUTES old. lastActivityAt only moves on real user activity (the client's
// POST /api/auth/activity), never on ordinary requests — background polling (notifications,
// submission refreshes) would otherwise keep an unattended session alive forever.
//
// Tokens issued before this table existed have no row, so `protect` treats them as ended —
// everyone signs in once more after this deploy, and from then on every session is tracked.
exports.up = async function up(knex) {
  await knex.schema.createTable("user_sessions", (table) => {
    table.string("jti", 36).primary();
    fk(table, "userId").notNullable();
    table.datetime("lastActivityAt", { precision: 3 }).notNullable();
    // The token's own exp — past it the JWT fails verification anyway, so the row can be pruned.
    table.datetime("expiresAt").notNullable();
    table.datetime("createdAt", { precision: 3 }).notNullable();
    table.index("userId");
    table.index("expiresAt");
  });
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists("user_sessions");
};
