const { id, fk, timestamps } = require("../helpers");

// M-Pesa (Daraja) payments into the installation's Paybill — see modules/payments/mpesa/ and
// Guide/MPESA_INTEGRATION_PLAN.md.
//
//   - mpesa_stk_requests: every "check your phone" prompt we send (STK Push), whatever became of
//     it. A failed or cancelled prompt never touches billing_payments, so receipts stay clean.
//   - mpesa_transactions: money that actually arrived — from a prompt (source "stk") or paid
//     straight to the Paybill with an account number (source "c2b"). This is what staff reconcile
//     against the M-Pesa statement. `transId` is the M-Pesa receipt (e.g. "SJK4H7XY2Q") and is
//     UNIQUE, so a repeated callback can never be counted twice; `stkRequestId` is UNIQUE for the
//     same reason when a prompt is settled by a status check that carries no receipt.
//     `allocations` lists each invoice the money went to (normally one).
//   - leads.invoiceId: a bootcamp enrolment now raises its invoice at sign-up, so it can be paid
//     by M-Pesa before anyone marks it paid.
//
// Additive only — no existing row changes.
exports.up = async function up(knex) {
  if (!(await knex.schema.hasTable("mpesa_stk_requests"))) {
    await knex.schema.createTable("mpesa_stk_requests", (table) => {
      id(table);
      fk(table, "ownerAdminId").nullable();
      fk(table, "invoiceId").notNullable();
      fk(table, "initiatedBy").nullable();
      table.string("phone", 15).notNullable();
      table.integer("amount").notNullable();
      table.string("accountReference", 20).notNullable();
      table.string("merchantRequestId", 80).nullable();
      table.string("checkoutRequestId", 80).nullable().unique();
      table.string("status", 20).notNullable().defaultTo("pending");
      table.string("resultCode", 20).nullable();
      table.string("resultDesc", 255).nullable();
      table.string("mpesaReceiptNumber", 40).nullable();
      fk(table, "transactionId").nullable();
      table.json("callbackPayload").nullable();
      table.datetime("lastQueriedAt").nullable();
      timestamps(table);
      table.index(["invoiceId", "status"]);
      table.index(["status", "createdAt"]);
      table.index(["initiatedBy", "createdAt"]);
      table.index("ownerAdminId");
    });
  }

  if (!(await knex.schema.hasTable("mpesa_transactions"))) {
    await knex.schema.createTable("mpesa_transactions", (table) => {
      id(table);
      fk(table, "ownerAdminId").nullable();
      table.string("source", 20).notNullable();
      table.string("shortcode", 20).nullable();
      table.string("transId", 40).nullable().unique();
      fk(table, "stkRequestId").nullable().unique();
      table.datetime("transTime").nullable();
      table.decimal("amount", 12, 2).notNullable();
      table.string("msisdn", 100).nullable();
      table.string("payerName", 150).nullable();
      table.string("billRefNumber", 60).nullable();
      table.string("status", 30).notNullable().defaultTo("unallocated");
      fk(table, "invoiceId").nullable();
      fk(table, "paymentId").nullable();
      table.decimal("unallocatedAmount", 12, 2).notNullable().defaultTo(0);
      table.json("allocations").nullable();
      table.string("note", 255).nullable();
      fk(table, "allocatedBy").nullable();
      table.datetime("allocatedAt").nullable();
      table.json("rawPayload").nullable();
      timestamps(table);
      table.index(["ownerAdminId", "status"]);
      table.index("invoiceId");
      table.index("transTime");
    });
  }

  if (!(await knex.schema.hasColumn("leads", "invoiceId"))) {
    await knex.schema.alterTable("leads", (table) => {
      fk(table, "invoiceId").nullable();
      table.index("invoiceId");
    });
  }
};

exports.down = async function down(knex) {
  if (await knex.schema.hasColumn("leads", "invoiceId")) {
    await knex.schema.alterTable("leads", (table) => {
      table.dropIndex("invoiceId");
      table.dropColumn("invoiceId");
    });
  }
  await knex.schema.dropTableIfExists("mpesa_transactions");
  await knex.schema.dropTableIfExists("mpesa_stk_requests");
};
