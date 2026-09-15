// Non-school hubs bill learners per space usage (see hub-visits module) rather than per term.
// A learner's enrollment at a hub now optionally records WHICH space (learning_hubs.spaces[]
// entry, by id) they're placed at, and an optional negotiated rate/unit override distinct from
// that space's own list price. Both stay null for every school-hub enrollment (which never
// carries a space) and for a non-school enrollment made before a space is assigned.
//
// spaceId isn't a fk() to a real table row — spaces[] is a JSON array on learning_hubs, not its
// own table — but it's the same 36-char id shape every other id in this app uses (see
// learning-hub.service.js's space-id backfill), so it's declared with fk() for consistency.
//
// Idempotent (hasColumn guards) so a re-run / partial rollback is safe.
const COLS = ["spaceId", "pricingOverrideRate", "pricingOverrideUnit"];

exports.up = async function up(knex) {
  const { fk } = require("../helpers");
  const present = {};
  for (const c of COLS) present[c] = await knex.schema.hasColumn("learner_hub_links", c);

  await knex.schema.alterTable("learner_hub_links", (t) => {
    if (!present.spaceId) fk(t, "spaceId").nullable();
    if (!present.pricingOverrideRate) t.decimal("pricingOverrideRate", 12, 2).nullable();
    if (!present.pricingOverrideUnit) t.string("pricingOverrideUnit", 30).nullable();
  });

  if (!present.spaceId) {
    await knex.schema.alterTable("learner_hub_links", (t) => t.index("spaceId"));
  }
};

exports.down = async function down(knex) {
  const present = {};
  for (const c of COLS) present[c] = await knex.schema.hasColumn("learner_hub_links", c);
  await knex.schema.alterTable("learner_hub_links", (t) => {
    if (present.spaceId) t.dropIndex("spaceId");
    for (const c of COLS) if (present[c]) t.dropColumn(c);
  });
};
