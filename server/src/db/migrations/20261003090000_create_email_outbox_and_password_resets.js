const { id, fk, timestamps } = require("../helpers");

// Real outbound email for accounts: password resets, invoice/receipt emails and emailed
// notifications (see shared/mail/mail.service.js).
//
// email_outbox — every one of those emails is written here first and delivered from this row, so
// a failed send is visible and retried instead of vanishing into a log line. `dedupeKey` makes
// "this invoice was already emailed" safe to call twice. A `sensitive` row (a password-reset
// link) has its body wiped once it's sent or has expired, so the link never lingers in the table.
//
// password_reset_tokens — only the SHA-256 of a reset token is stored; the token itself exists
// only in the emailed link.
//
// users.emailPreferences — per-user opt-outs for emailed notifications ({ all, <type> }). NULL
// means "the defaults". Account and billing emails ignore it.
exports.up = async function up(knex) {
  await knex.schema.createTable("email_outbox", (table) => {
    id(table);
    table.string("toEmail", 255).notNullable();
    table.string("subject", 255).notNullable();
    table.text("html", "mediumtext").nullable();
    table.text("text").nullable();
    table.string("replyTo", 255).nullable();
    table.string("fromName", 150).nullable();
    table.string("template", 60).notNullable();
    fk(table, "userId").nullable();
    table.string("dedupeKey", 200).nullable();
    // pending | sending | sent | failed (will retry) | dead (gave up) | skipped (no SMTP) | expired
    table.string("status", 20).notNullable().defaultTo("pending");
    table.integer("attempts").notNullable().defaultTo(0);
    table.string("lastError", 500).nullable();
    table.datetime("nextAttemptAt").nullable();
    table.datetime("sentAt").nullable();
    table.boolean("sensitive").notNullable().defaultTo(false);
    table.datetime("expiresAt").nullable();
    timestamps(table);
    table.unique("dedupeKey");
    table.index(["status", "nextAttemptAt"]);
    table.index("userId");
  });

  await knex.schema.createTable("password_reset_tokens", (table) => {
    id(table);
    fk(table, "userId").notNullable();
    table.string("tokenHash", 64).notNullable();
    table.datetime("expiresAt").notNullable();
    table.datetime("usedAt").nullable();
    timestamps(table, { updatedAt: false });
    table.unique("tokenHash");
    table.index("userId");
  });

  await knex.schema.alterTable("users", (table) => {
    table.json("emailPreferences").nullable();
  });
};

exports.down = async function down(knex) {
  await knex.schema.alterTable("users", (table) => {
    table.dropColumn("emailPreferences");
  });
  await knex.schema.dropTableIfExists("password_reset_tokens");
  await knex.schema.dropTableIfExists("email_outbox");
};
