const { id, fk, timestamps } = require("../helpers");

exports.up = async function up(knex) {
  await knex.schema
    .createTable("billing_invoices", (table) => {
      id(table);
      table.string("invoiceNumber", 40).notNullable().unique();
      table.enu("issuerType", ["platform", "learning_hub"]).notNullable();
      fk(table, "issuerHubId").nullable();
      fk(table, "payerUserId").nullable();
      fk(table, "payerHubId").nullable();
      fk(table, "learnerId").nullable();
      fk(table, "hubId").notNullable();
      table.enu("invoiceType", ["hub_subscription", "learner_term", "course_module", "bootcamp"]).notNullable();
      table.enu("status", ["draft", "issued", "partially_paid", "paid", "overdue", "cancelled", "void"]).notNullable().defaultTo("draft");
      table.string("currency", 3).notNullable().defaultTo("KES");
      table.decimal("subtotal", 12, 2).notNullable().defaultTo(0);
      table.decimal("discount", 12, 2).notNullable().defaultTo(0);
      table.decimal("total", 12, 2).notNullable().defaultTo(0);
      table.decimal("amountPaid", 12, 2).notNullable().defaultTo(0);
      table.date("periodStart").nullable();
      table.date("periodEnd").nullable();
      table.string("periodLabel", 100).nullable();
      table.datetime("issuedAt").nullable();
      table.datetime("dueAt").nullable();
      table.datetime("paidAt").nullable();
      table.text("notes").nullable();
      timestamps(table);
      table.index("issuerHubId");
      table.index("payerUserId");
      table.index("payerHubId");
      table.index("learnerId");
      table.index("hubId");
      table.index("status");
    })
    .createTable("billing_invoice_items", (table) => {
      id(table);
      fk(table, "invoiceId").notNullable();
      fk(table, "learnerId").nullable();
      fk(table, "courseId").nullable();
      table.string("description", 255).notNullable();
      table.decimal("quantity", 10, 2).notNullable().defaultTo(1);
      table.decimal("unitAmount", 12, 2).notNullable();
      table.decimal("totalAmount", 12, 2).notNullable();
      table.json("metadata").nullable();
      timestamps(table, { updatedAt: false });
      table.index("invoiceId");
      table.index("learnerId");
      table.index("courseId");
    })
    .createTable("billing_payments", (table) => {
      id(table);
      fk(table, "invoiceId").notNullable();
      fk(table, "payerUserId").nullable();
      table.string("provider", 40).notNullable().defaultTo("manual");
      table.string("providerReference", 120).nullable().unique();
      table.decimal("amount", 12, 2).notNullable();
      table.string("currency", 3).notNullable().defaultTo("KES");
      table.enu("status", ["pending", "successful", "failed", "refunded", "reversed"]).notNullable().defaultTo("pending");
      table.string("paymentMethod", 40).nullable();
      table.datetime("paidAt").nullable();
      table.string("failureReason", 255).nullable();
      table.json("metadata").nullable();
      timestamps(table);
      table.index("invoiceId");
      table.index("payerUserId");
      table.index("status");
    });
};

exports.down = async function down(knex) {
  await knex.schema
    .dropTableIfExists("billing_payments")
    .dropTableIfExists("billing_invoice_items")
    .dropTableIfExists("billing_invoices");
};
