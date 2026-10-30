// Packages billed by the day, week, month, quarter or year, invoiced automatically (31 Oct 2026).
// See shared/utils/billing-periods.js and modules/billing/package-billing.js.
//
//   home_learning_packages / club_packages
//     monthlyAmount → amount     the price per period
//     billingPeriod              daily | weekly | monthly | quarterly | annually (existing: monthly)
//   home_learning_households / club_memberships
//     monthlyAmount → amount     the family's price per period, kept from when they joined
//     billingPeriod              the family's period, likewise
//     billingAnchor              the day their periods count from (the day they joined)
//     billedThrough              the last day already invoiced — the next invoice starts after it
//     pendingBilling             a change of price / period waiting for the next period (JSON)
//
// Existing families carry on billed by calendar month: their periods count from the first month
// they were invoiced for (else this month), and they're billed through the later of their last
// invoice and last month — so the first automatic run invoices this month for any active family
// not invoiced for it yet, and nothing earlier.
const { kenyaToday } = require("../../shared/utils/age");

const PACKAGES = ["home_learning_packages", "club_packages"];
const FAMILIES = [
  { table: "home_learning_households", invoiceKey: "householdId", invoiceType: "home_learning" },
  { table: "club_memberships", invoiceKey: "clubMembershipId", invoiceType: "tech_club" },
];

const pad = (n) => String(n).padStart(2, "0");
const asDate = (value) => (value instanceof Date ? value.toISOString().slice(0, 10) : value ? String(value).slice(0, 10) : null);

exports.up = async function up(knex) {
  for (const table of [...PACKAGES, ...FAMILIES.map((f) => f.table)]) {
    if (await knex.schema.hasColumn(table, "monthlyAmount")) {
      await knex.schema.alterTable(table, (t) => t.renameColumn("monthlyAmount", "amount"));
    }
    if (!(await knex.schema.hasColumn(table, "billingPeriod"))) {
      await knex.schema.alterTable(table, (t) => t.string("billingPeriod", 10).notNullable().defaultTo("monthly"));
    }
  }

  const today = kenyaToday();
  const [y, m] = today.split("-").map(Number);
  const thisMonthStart = `${y}-${pad(m)}-01`;
  const lastMonthEnd = new Date(Date.UTC(y, m - 1, 0)).toISOString().slice(0, 10);

  for (const { table, invoiceKey, invoiceType } of FAMILIES) {
    if (await knex.schema.hasColumn(table, "billingAnchor")) continue;
    await knex.schema.alterTable(table, (t) => {
      t.string("billingAnchor", 10).nullable();
      t.string("billedThrough", 10).nullable();
      t.json("pendingBilling").nullable();
    });
    for (const family of await knex(table).select("id")) {
      const invoices = await knex("billing_invoices")
        .where({ [invoiceKey]: family.id, invoiceType })
        .whereNotIn("status", ["cancelled", "void"])
        .whereNotNull("periodStart")
        .select("periodStart", "periodEnd");
      const starts = invoices.map((i) => asDate(i.periodStart)).filter(Boolean).sort();
      const ends = invoices.map((i) => asDate(i.periodEnd)).filter(Boolean).sort();
      const lastEnd = ends[ends.length - 1] || null;
      await knex(table).where({ id: family.id }).update({
        billingAnchor: starts[0] || thisMonthStart,
        billedThrough: lastEnd && lastEnd > lastMonthEnd ? lastEnd : lastMonthEnd,
      });
    }
  }
};

exports.down = async function down(knex) {
  for (const { table } of FAMILIES) {
    if (await knex.schema.hasColumn(table, "billingAnchor")) {
      await knex.schema.alterTable(table, (t) => {
        t.dropColumn("billingAnchor");
        t.dropColumn("billedThrough");
        t.dropColumn("pendingBilling");
      });
    }
  }
  for (const table of [...PACKAGES, ...FAMILIES.map((f) => f.table)]) {
    if (await knex.schema.hasColumn(table, "billingPeriod")) await knex.schema.alterTable(table, (t) => t.dropColumn("billingPeriod"));
    if (await knex.schema.hasColumn(table, "amount")) await knex.schema.alterTable(table, (t) => t.renameColumn("amount", "monthlyAmount"));
  }
};
