// system_levels.name carried a global UNIQUE(name) index (see
// 20260827100000_add_system_levels_unique_name.js) — correct back when every admin shared one
// spine, but now that system_levels is tenant-scoped (ownerAdminId, see
// 20260907105000_add_owner_admin_id_to_settings_tables.js) it would wrongly block a second admin
// from ever naming a level "Level 1", since some other tenant already used that name. Replace it
// with a composite UNIQUE(ownerAdminId, name) — unique within one admin's own spine, free to
// repeat across tenants.
exports.up = async function up(knex) {
  await knex.schema.alterTable("system_levels", (t) => {
    t.dropUnique("name", "system_levels_name_unique");
  });
  await knex.schema.alterTable("system_levels", (t) => {
    t.unique(["ownerAdminId", "name"], { indexName: "system_levels_owner_name_unique" });
  });
};

exports.down = async function down(knex) {
  await knex.schema.alterTable("system_levels", (t) => {
    t.dropUnique(["ownerAdminId", "name"], "system_levels_owner_name_unique");
  });
  await knex.schema.alterTable("system_levels", (t) => {
    t.unique("name", { indexName: "system_levels_name_unique" });
  });
};
