const { id, fk, timestamps } = require("../helpers");

// Part payments (28 Oct 2026). An invoice can be paid in parts at any time; these add a plan for
// the parts and what follows when one is missed.
//
//   billing_invoice_instalments   an invoice's payment schedule: each part's label, amount and due
//                                 date (a Kenyan calendar date, "YYYY-MM-DD"). Payments still go
//                                 onto the invoice; they count towards the earliest part first,
//                                 so a part's state (paid / part paid / due / overdue) is worked
//                                 out, never stored (billing.instalments.js). The parts add up to
//                                 the invoice's total.
//   billing_invoices.paymentPlanKey  the plan the schedule came from (a key in the workspace's
//                                 partPayments.plans), "custom" when staff typed it, null with none.
//   billing_access_pauses         a family's learner accounts paused because a payment is overdue
//                                 past the grace days (billing.access.js) — which learner, for
//                                 which invoice — so paying it switches back on exactly those.
//
// What part payments allow (plans families may choose, the share that switches a sign-up on,
// grace days, pausing) is the workspace's `partPayments` in payment_options (payment-options.js).
// No DB-level foreign keys, as everywhere else in this schema (see helpers.js).
exports.up = async function up(knex) {
  if (!(await knex.schema.hasTable("billing_invoice_instalments"))) {
    await knex.schema.createTable("billing_invoice_instalments", (table) => {
      id(table);
      fk(table, "invoiceId").notNullable();
      table.integer("sequence").notNullable();
      table.string("label", 80).notNullable();
      table.decimal("amount", 12, 2).notNullable();
      table.date("dueDate").notNullable();
      timestamps(table);
      table.unique(["invoiceId", "sequence"]);
      table.index("dueDate");
    });
  }
  if (!(await knex.schema.hasColumn("billing_invoices", "paymentPlanKey"))) {
    await knex.schema.alterTable("billing_invoices", (table) => table.string("paymentPlanKey", 40).nullable());
  }
  if (!(await knex.schema.hasTable("billing_access_pauses"))) {
    await knex.schema.createTable("billing_access_pauses", (table) => {
      id(table);
      fk(table, "invoiceId").notNullable();
      fk(table, "learnerId").notNullable();
      table.datetime("pausedAt").notNullable();
      table.datetime("resumedAt").nullable();
      timestamps(table);
      table.index(["invoiceId", "resumedAt"]);
      table.index(["learnerId", "resumedAt"]);
    });
  }
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists("billing_access_pauses");
  if (await knex.schema.hasColumn("billing_invoices", "paymentPlanKey")) {
    await knex.schema.alterTable("billing_invoices", (table) => table.dropColumn("paymentPlanKey"));
  }
  await knex.schema.dropTableIfExists("billing_invoice_instalments");
};
