const { fk, timestamps } = require("../helpers");

// Logout denylist: the current JWT design has no server-side session to invalidate, so a
// stolen/copied cookie stays valid until it naturally expires even after the owner "logs out".
// This table closes that gap without a full session store — auth.middleware.js's protect()
// checks a token's `jti` claim against it on every request, and AuthService.logout() inserts
// the current token's jti here instead of only clearing the client's cookie. Rows are keyed
// by jti (not a generated id) since that's the only lookup this table ever needs, and expiresAt
// mirrors the token's own `exp` claim so stale rows (already-expired tokens jwt.verify would
// reject on its own) can be pruned instead of accumulating forever.
exports.up = async function up(knex) {
  await knex.schema.createTable("revoked_tokens", (table) => {
    table.string("jti", 36).primary();
    fk(table, "userId").nullable();
    table.datetime("expiresAt").notNullable();
    timestamps(table, { updatedAt: false });
    table.index("expiresAt");
  });
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists("revoked_tokens");
};
