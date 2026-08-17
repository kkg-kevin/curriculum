// A separate opaque secret for the "share via QR" feature — deliberately not the learner's own
// `id` (a UUID which is already unguessable, but reusing it here would mean "regenerate the
// share link" has to mean "change the learner's primary key", cascading into every FK that
// points at this learner). Nullable + lazily generated on first share rather than backfilled,
// so a learner nobody has ever shared never carries a live public link.
exports.up = async function up(knex) {
  await knex.schema.alterTable("learners", (table) => {
    table.string("publicToken", 64).nullable().unique();
  });
};

exports.down = async function down(knex) {
  await knex.schema.alterTable("learners", (table) => {
    table.dropColumn("publicToken");
  });
};
