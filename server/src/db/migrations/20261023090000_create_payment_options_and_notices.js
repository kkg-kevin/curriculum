const { id, fk, timestamps } = require("../helpers");

// Paying at the end of a website sign-up (Home Learning, Tech Club, Bootcamp) — see
// payments/payment-options.js and payments/payment-notices.service.js.
//
//   - payment_options: how a workspace's families can pay (Settings → Payments → "How families can
//     pay"): M-Pesa Paybill, M-Pesa Send Money, bank transfer, cheque, cash — each switched on or
//     off with its details, kept as one JSON object per workspace.
//   - payment_notices: a family saying "I've paid" — the method, the M-Pesa code / bank reference /
//     cheque number, and the amount. Staff confirm it (which records the payment and switches the
//     sign-up on) or reject it in Billing → To confirm. `dedupeKey` is the M-Pesa code, so one
//     code can't be claimed twice.
//
// Additive only.
exports.up = async function up(knex) {
  if (!(await knex.schema.hasTable("payment_options"))) {
    await knex.schema.createTable("payment_options", (table) => {
      id(table);
      fk(table, "ownerAdminId").notNullable().unique();
      table.json("options").notNullable();
      fk(table, "updatedBy").nullable();
      timestamps(table);
    });
  }

  if (!(await knex.schema.hasTable("payment_notices"))) {
    await knex.schema.createTable("payment_notices", (table) => {
      id(table);
      fk(table, "ownerAdminId").nullable();
      fk(table, "invoiceId").notNullable();
      fk(table, "linkId").nullable();
      table.string("method", 20).notNullable();
      table.string("status", 20).notNullable().defaultTo("pending");
      table.string("reference", 80).nullable();
      table.string("dedupeKey", 100).nullable().unique();
      table.decimal("amount", 12, 2).notNullable();
      table.string("payerName", 150).nullable();
      table.string("payerPhone", 20).nullable();
      table.string("note", 500).nullable();
      fk(table, "paymentId").nullable();
      fk(table, "reviewedBy").nullable();
      table.datetime("reviewedAt").nullable();
      table.string("reviewNote", 500).nullable();
      timestamps(table);
      table.index(["ownerAdminId", "status"]);
      table.index("invoiceId");
    });
  }
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists("payment_notices");
  await knex.schema.dropTableIfExists("payment_options");
};
