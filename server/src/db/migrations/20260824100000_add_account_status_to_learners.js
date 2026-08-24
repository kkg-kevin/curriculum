exports.up = async function up(knex) {
  await knex.schema.alterTable("learners", (table) => {
    table.enu("accountStatus", ["active", "inactive"]).notNullable().defaultTo("active");
    table.index("accountStatus");
  });
};

exports.down = async function down(knex) {
  await knex.schema.alterTable("learners", (table) => {
    table.dropIndex("accountStatus");
    table.dropColumn("accountStatus");
  });
};
