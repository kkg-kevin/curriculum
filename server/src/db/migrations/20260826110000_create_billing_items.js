const { id, timestamps } = require("../helpers");

// A small billing-only catalog (name/description/defaultPrice/unit) so the invoice form can
// prefill Description+Amount from a pick-list instead of typing both every time — deliberately
// separate from the "inventory" table, which is a physical-materials catalog already wired into
// Courses and Assessments and has no price field.
exports.up = async function up(knex) {
  await knex.schema.createTable("billing_items", (table) => {
    id(table);
    table.string("name", 150).notNullable();
    table.text("description").nullable();
    table.decimal("defaultPrice", 12, 2).nullable();
    table.string("unit", 30).notNullable().defaultTo("item");
    table.enu("invoiceType", ["hub_subscription", "learner_term", "course_module", "bootcamp"]).nullable();
    timestamps(table);
  });
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists("billing_items");
};
