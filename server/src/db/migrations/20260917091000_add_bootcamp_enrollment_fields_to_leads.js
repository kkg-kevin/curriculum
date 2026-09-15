// A lead submitted through the new bootcamp-enrollment flow (see the bootcamp-enrollment
// module) auto-provisions a real learner account, enrolled at a specific hub — this records
// which learner/hub/bootcamp that lead resulted in, plus the cash-payment facts once an admin
// records them via POST /api/leads/:id/mark-paid.
//
// paidAmount/paidCurrency/paidAt/paidByUserId are a deliberate small denormalization, not a
// break from this app's "derive don't duplicate" convention elsewhere (billing.service.js's
// getCustomer/listCustomers, hub-visits' revenue summaries): the Enquiries list needs a fast
// "is this paid, and for how much" column without joining out to billing_invoices per row, and
// bootcamp-enrollment.service.js's markLeadPaid writes both the lead's cache fields and the real
// billing_invoices/billing_payments rows in one transaction, so they can never drift at write
// time. billing remains the source of truth for the actual money.
//
// Idempotent (hasColumn guards) so a re-run / partial rollback is safe.
const COLS = ["learnerId", "hubId", "bootcampId", "paidAmount", "paidCurrency", "paidAt", "paidByUserId"];

exports.up = async function up(knex) {
  const { fk } = require("../helpers");
  const present = {};
  for (const c of COLS) present[c] = await knex.schema.hasColumn("leads", c);

  await knex.schema.alterTable("leads", (t) => {
    if (!present.learnerId) fk(t, "learnerId").nullable();
    if (!present.hubId) fk(t, "hubId").nullable();
    if (!present.bootcampId) fk(t, "bootcampId").nullable();
    if (!present.paidAmount) t.decimal("paidAmount", 12, 2).nullable();
    if (!present.paidCurrency) t.string("paidCurrency", 8).nullable();
    if (!present.paidAt) t.datetime("paidAt").nullable();
    if (!present.paidByUserId) fk(t, "paidByUserId").nullable();
  });

  await knex.schema.alterTable("leads", (t) => {
    if (!present.learnerId) t.index("learnerId");
    if (!present.hubId) t.index("hubId");
    if (!present.bootcampId) t.index("bootcampId");
  });
};

exports.down = async function down(knex) {
  const present = {};
  for (const c of COLS) present[c] = await knex.schema.hasColumn("leads", c);
  await knex.schema.alterTable("leads", (t) => {
    if (present.learnerId) t.dropIndex("learnerId");
    if (present.hubId) t.dropIndex("hubId");
    if (present.bootcampId) t.dropIndex("bootcampId");
    for (const c of COLS) if (present[c]) t.dropColumn(c);
  });
};
