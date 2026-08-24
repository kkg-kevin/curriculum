const { id, fk, timestamps } = require("../helpers");

exports.up = async function up(knex) {
  await knex.schema
    .createTable("billing_invoice_batches", (table) => {
      id(table);
      table.string("batchNumber", 40).notNullable().unique();
      fk(table, "hubId").notNullable();
      fk(table, "createdBy").notNullable();
      table.enu("scopeType", ["hub", "class", "learners"]).notNullable();
      fk(table, "classId").nullable();
      table.enu("invoiceType", ["learner_term", "course_module", "bootcamp"]).notNullable();
      table.enu("status", ["processing", "completed", "completed_with_errors", "cancelled"]).notNullable().defaultTo("processing");
      table.string("periodLabel", 100).nullable();
      table.datetime("dueAt").nullable();
      table.decimal("unitAmount", 12, 2).notNullable();
      table.integer("totalLearners").notNullable().defaultTo(0);
      table.integer("createdInvoices").notNullable().defaultTo(0);
      table.integer("skippedLearners").notNullable().defaultTo(0);
      table.decimal("totalAmount", 12, 2).notNullable().defaultTo(0);
      timestamps(table);
      table.index("hubId");
      table.index("classId");
      table.index("status");
    })
    .alterTable("billing_invoices", (table) => {
      fk(table, "batchId").nullable();
      table.index("batchId");
    });
};

exports.down = async function down(knex) {
  await knex.schema.alterTable("billing_invoices", (table) => {
    table.dropIndex("batchId");
    table.dropColumn("batchId");
  });
  await knex.schema.dropTableIfExists("billing_invoice_batches");
};
