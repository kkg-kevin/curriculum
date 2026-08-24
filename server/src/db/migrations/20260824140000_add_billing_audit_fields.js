const { id, fk, timestamps } = require("../helpers");

exports.up = async function up(knex) {
  await knex.schema
    .alterTable("billing_payments", (table) => {
      fk(table, "recordedBy").nullable();
      table.datetime("paymentDate").nullable();
      table.string("receiptNumber", 50).nullable().unique();
      table.text("notes").nullable();
      table.index("recordedBy");
      table.index("paymentDate");
    })
    .createTable("billing_audit_events", (table) => {
      id(table);
      fk(table, "invoiceId").nullable();
      fk(table, "paymentId").nullable();
      fk(table, "batchId").nullable();
      fk(table, "actorUserId").nullable();
      table.string("eventType", 40).notNullable();
      table.string("previousStatus", 30).nullable();
      table.string("newStatus", 30).nullable();
      table.decimal("amount", 12, 2).nullable();
      table.json("metadata").nullable();
      timestamps(table, { updatedAt: false });
      table.index("invoiceId");
      table.index("paymentId");
      table.index("batchId");
      table.index("actorUserId");
      table.index("eventType");
    });
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists("billing_audit_events");
  await knex.schema.alterTable("billing_payments", (table) => {
    table.dropIndex("recordedBy");
    table.dropIndex("paymentDate");
    table.dropColumn("recordedBy");
    table.dropColumn("paymentDate");
    table.dropColumn("receiptNumber");
    table.dropColumn("notes");
  });
};
