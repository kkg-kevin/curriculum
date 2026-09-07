// Separate from 20260907105000_add_owner_admin_id_to_settings_tables.js on purpose — same
// reasoning as 20260907090100_make_owner_admin_id_not_nullable.js: the notNullable flip runs as
// its own explicit step, not silently bundled into the same alterTable as the nullable add.
exports.up = async function up(knex) {
  for (const table of ["competencies", "pathway_templates", "system_levels", "inventory", "billing_items"]) {
    await knex.schema.alterTable(table, (t) => {
      t.string("ownerAdminId", 36).notNullable().alter();
    });
  }
};

exports.down = async function down(knex) {
  for (const table of ["competencies", "pathway_templates", "system_levels", "inventory", "billing_items"]) {
    await knex.schema.alterTable(table, (t) => {
      t.string("ownerAdminId", 36).nullable().alter();
    });
  }
};
