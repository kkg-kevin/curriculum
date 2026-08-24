exports.up = async function up(knex) {
  await knex.schema.alterTable("billing_payments", (table) => {
    table.string("idempotencyKey", 100).nullable().unique();
    table.index("idempotencyKey");
  });
};

exports.down = async function down(knex) {
  await knex.schema.alterTable("billing_payments", (table) => {
    table.dropIndex("idempotencyKey");
    table.dropColumn("idempotencyKey");
  });
};
