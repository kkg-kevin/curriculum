// Separate from 20260907090000_add_owner_admin_id_to_root_tables.js on purpose — that migration's
// backfill only reaches rows that existed at migration time. Splitting the notNullable flip into
// its own migration means it runs (and fails loudly, if anything was still missed) as an explicit
// second step, not silently bundled into the same alterTable as the nullable add.
exports.up = async function up(knex) {
  for (const table of ["learning_hubs", "curricula", "courses", "assessments"]) {
    await knex.schema.alterTable(table, (t) => {
      t.string("ownerAdminId", 36).notNullable().alter();
    });
  }
};

exports.down = async function down(knex) {
  for (const table of ["learning_hubs", "curricula", "courses", "assessments"]) {
    await knex.schema.alterTable(table, (t) => {
      t.string("ownerAdminId", 36).nullable().alter();
    });
  }
};
