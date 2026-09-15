// New invoice type: "hub_usage" - a non-school hub billing a learner for logged space visits
// (see the hub-visits module). Unlike every other invoiceType, these are never created through
// the generic POST /api/billing route or the manual/bulk invoice UI - only
// hub-visit.service.js's generateCharges writes them, straight to billing_invoices via
// BillingModel (see that module's header comment for why). So only billing_invoices.invoiceType
// needs widening here:
//   - billing_invoice_batches.invoiceType stays as-is (learner_term/course_module/bootcamp only)
//     because hub_usage invoices are never created via createBulkInvoices/its batch tracking.
//   - billing_items.invoiceType (the manual "bill from item" catalog picker) stays as-is because
//     hub_usage invoices are never manually created, so there is nothing to prefill.
//
// Knex's schema builder can't alter a MySQL enum's allowed values in place, so this uses a raw
// ALTER TABLE ... MODIFY. Idempotent-safe to re-run (MODIFY is not additive-only, but re-running
// the same MODIFY is a no-op).
const OLD_VALUES = ["hub_subscription", "learner_term", "course_module", "bootcamp"];
const NEW_VALUES = [...OLD_VALUES, "hub_usage"];

function enumSql(values) {
  return values.map((v) => `'${v}'`).join(", ");
}

exports.up = async function up(knex) {
  await knex.raw(`ALTER TABLE billing_invoices MODIFY invoiceType ENUM(${enumSql(NEW_VALUES)}) NOT NULL`);
};

exports.down = async function down(knex) {
  // Any existing hub_usage invoices would need to be reassigned or removed before this can run
  // cleanly - MySQL truncates values not in the target ENUM list to '' rather than failing loudly.
  await knex.raw(`ALTER TABLE billing_invoices MODIFY invoiceType ENUM(${enumSql(OLD_VALUES)}) NOT NULL`);
};
