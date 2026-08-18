const { id, fk, timestamps } = require("../helpers");

exports.up = async function up(knex) {
  await knex.schema.createTable("notifications", (table) => {
    id(table);
    // A users.id — notifications are addressed to a specific LOGIN, not a business entity, so
    // a learner with both a guardian-mediated account and their own dedicated username login
    // (see auth.service.js) can get one row per account that actually exists.
    fk(table, "recipientId").notNullable();
    table.string("type", 50).notNullable();
    table.string("title", 200).notNullable();
    table.string("message", 500).notNullable();
    // Deep-link data for the client (assessmentId/submissionId/reportId/bandId/etc.) — shape
    // varies per type, same "just a JSON bag" pattern as every other JSON column in this schema.
    table.json("payload").nullable();
    // Set only by events that can legitimately recompute to "still true" on every subsequent
    // trigger (e.g. a learner staying in an already-unlocked band) — see
    // notification.service.js's maybeNotifyLevelUp. NULL (most types) means "never dedupe,
    // every event is its own row" — MySQL allows unlimited NULLs through a unique index, so
    // this coexists with the constraint below untouched.
    table.string("dedupeKey", 200).nullable();
    table.boolean("isRead").notNullable().defaultTo(false);
    timestamps(table);
    table.index(["recipientId", "isRead"]);
    table.unique(["recipientId", "dedupeKey"]);
  });
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists("notifications");
};
