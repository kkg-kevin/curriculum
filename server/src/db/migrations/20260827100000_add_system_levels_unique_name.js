// Nothing at the DB layer stopped two "Level 1" rows from ever existing — creation only checked
// for an existing name via a separate SELECT (system-level.service.js's createSystemLevel),
// which a double-click (or any two concurrent requests) can race past, both passing the check
// before either INSERT lands. A real UNIQUE index closes that race at the one layer that can
// actually enforce it atomically; the service now catches the resulting DB error and reports it
// as the same friendly 409 it already used for the pre-check.
exports.up = async function up(knex) {
  await knex.schema.alterTable("system_levels", (table) => {
    table.unique("name", { indexName: "system_levels_name_unique" });
  });
};

exports.down = async function down(knex) {
  await knex.schema.alterTable("system_levels", (table) => {
    table.dropUnique("name", "system_levels_name_unique");
  });
};
