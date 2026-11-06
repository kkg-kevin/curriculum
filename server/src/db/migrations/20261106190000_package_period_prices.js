// A package priced for several billing periods (6 Nov 2026): one Home Learning, Tech Club or
// pathway package can be offered weekly, monthly, every 3 months and yearly, each at its own price
// (and its own price per extra child) — the website's package cards switch between them.
//
//   home_learning_packages / club_packages / pathway_packages.periodPrices
//     [{ billingPeriod, amount, extraChildAmount }] in period order (home-learning.pricing.js).
//     The package's own amount / billingPeriod / extraChildAmount stay: they're the price shown
//     first, kept in step on every save, so everything reading them carries on.
//
// Existing packages get their one price as their only entry. Daily packages (no longer offered —
// a package is weekly, monthly, quarterly or yearly) get none and keep billing daily as before
// until they're edited.
const TABLES = ["home_learning_packages", "club_packages", "pathway_packages"];
const OFFERED = ["weekly", "monthly", "quarterly", "annually"];

exports.up = async function up(knex) {
  for (const table of TABLES) {
    if (!(await knex.schema.hasTable(table))) continue;
    if (!(await knex.schema.hasColumn(table, "periodPrices"))) {
      await knex.schema.alterTable(table, (t) => t.json("periodPrices").nullable());
    }
    const rows = await knex(table).whereNull("periodPrices").select("id", "amount", "billingPeriod", "extraChildAmount", "allowExtraChildren");
    for (const row of rows) {
      if (!OFFERED.includes(row.billingPeriod)) continue;
      const entry = {
        billingPeriod: row.billingPeriod,
        amount: Number(row.amount) || 0,
        extraChildAmount: row.allowExtraChildren && row.extraChildAmount != null ? Number(row.extraChildAmount) : null,
      };
      await knex(table).where({ id: row.id }).update({ periodPrices: JSON.stringify([entry]) });
    }
  }
};

exports.down = async function down(knex) {
  for (const table of TABLES) {
    if ((await knex.schema.hasTable(table)) && (await knex.schema.hasColumn(table, "periodPrices"))) {
      await knex.schema.alterTable(table, (t) => t.dropColumn("periodPrices"));
    }
  }
};
