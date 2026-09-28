exports.up = async function up(knex) {
  await knex.schema.alterTable("leads", (table) => {
    table.string("homeLearningHouseholdId", 36).nullable();
    table.index("homeLearningHouseholdId");
  });
};

exports.down = async function down(knex) {
  await knex.schema.alterTable("leads", (table) => {
    table.dropIndex("homeLearningHouseholdId");
    table.dropColumn("homeLearningHouseholdId");
  });
};
