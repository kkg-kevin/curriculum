// Virtual / hybrid learning hubs. A hub keeps its `hubType` (makerspace, tech_club, …) and now
// also carries HOW it's delivered:
//   deliveryMode — 'in_person' (default, every existing hub), 'virtual', or 'hybrid'
//   meetingLink  — the Zoom/Meet/etc join link, for virtual & hybrid hubs
//
// deliveryMode is orthogonal to hubType (a virtual makerspace and a virtual tech club are both
// valid), so it's its own column, not a new hubType value. Existing behaviour is unchanged:
// everything defaults to 'in_person', and a physical hub's address stays required (enforced in
// the Zod schema, conditionally on deliveryMode).
//
// Idempotent (hasColumn guards) so a re-run / partial rollback is safe.
const COLS = ['deliveryMode', 'meetingLink'];

exports.up = async function up(knex) {
  const present = {};
  for (const c of COLS) present[c] = await knex.schema.hasColumn('learning_hubs', c);

  await knex.schema.alterTable('learning_hubs', (t) => {
    if (!present.deliveryMode) {
      t.enu('deliveryMode', ['in_person', 'virtual', 'hybrid']).notNullable().defaultTo('in_person');
    }
    if (!present.meetingLink) t.string('meetingLink', 500).nullable();
  });

  if (!present.deliveryMode) {
    await knex.schema.alterTable('learning_hubs', (t) => t.index('deliveryMode'));
  }
};

exports.down = async function down(knex) {
  const present = {};
  for (const c of COLS) present[c] = await knex.schema.hasColumn('learning_hubs', c);
  await knex.schema.alterTable('learning_hubs', (t) => {
    if (present.deliveryMode) t.dropIndex('deliveryMode');
    for (const c of COLS) if (present[c]) t.dropColumn(c);
  });
};
