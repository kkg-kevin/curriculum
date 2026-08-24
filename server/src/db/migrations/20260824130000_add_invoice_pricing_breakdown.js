exports.up = async function up(knex) {
  await knex.schema.alterTable("billing_invoices", (table) => {
    table.string("classId", 36).nullable();
    table.enu("pricingMode", ["flat", "per_learner"]).nullable();
    table.decimal("unitAmount", 12, 2).nullable();
    table.integer("learnerCount").nullable();
    table.integer("classCount").nullable();
    table.index("classId");
  });
};

exports.down = async function down(knex) {
  await knex.schema.alterTable("billing_invoices", (table) => {
    table.dropIndex("classId");
    table.dropColumn("classId");
    table.dropColumn("pricingMode");
    table.dropColumn("unitAmount");
    table.dropColumn("learnerCount");
    table.dropColumn("classCount");
  });
};
