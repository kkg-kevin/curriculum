exports.up = async function up(knex) {
  await knex.schema.alterTable("competency_indicators", (table) => {
    table.integer("order").notNullable().defaultTo(0);
  });
};

exports.down = async function down(knex) {
  await knex.schema.alterTable("competency_indicators", (table) => {
    table.dropColumn("order");
  });
};
