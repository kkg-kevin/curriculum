const { id, fk } = require("../helpers");

// Affiliate targets (25 Nov 2026 — modules/affiliates/affiliate.targets.js): a monthly target in
// money (what the families an affiliate brought in paid that month) and in people (families whose
// first invoice was paid in full that month). Tracking only — reaching one earns nothing extra.
//   affiliates.targets           JSON { money, families, teamMoney, teamFamilies } — this
//                                affiliate's own targets; anything left out follows Settings (a
//                                manager's team target, when not set, is the sum of their team's)
//   affiliate_target_results     one row per affiliate per closed month (scope "own", and "team"
//                                for a manager): the targets as they stood and what was reached,
//                                so history never shifts when targets or records change later.
//                                Written once a month is over (billing:process, or the first page
//                                that needs it); UNIQUE (affiliateId, month, scope).
// New table: newer collation — never SQL-join it to older tables.
exports.up = async function up(knex) {
  if (!(await knex.schema.hasColumn("affiliates", "targets"))) {
    await knex.schema.alterTable("affiliates", (t) => {
      t.json("targets").nullable();
    });
  }
  if (!(await knex.schema.hasTable("affiliate_target_results"))) {
    await knex.schema.createTable("affiliate_target_results", (t) => {
      id(t);
      fk(t, "ownerAdminId").notNullable();
      fk(t, "affiliateId").notNullable();
      t.string("month", 7).notNullable(); // YYYY-MM, Kenyan calendar
      t.string("scope", 8).notNullable().defaultTo("own"); // own | team
      t.decimal("moneyTarget", 14, 2).nullable();
      t.integer("familiesTarget").nullable();
      t.decimal("money", 14, 2).notNullable().defaultTo(0);
      t.integer("families").notNullable().defaultTo(0);
      t.integer("teamSize").nullable();
      t.boolean("met").nullable(); // null: no target that month
      t.datetime("closedAt").notNullable();
      t.unique(["affiliateId", "month", "scope"]);
      t.index(["ownerAdminId", "month"]);
    });
  }
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists("affiliate_target_results");
  if (await knex.schema.hasColumn("affiliates", "targets")) {
    await knex.schema.alterTable("affiliates", (t) => t.dropColumn("targets"));
  }
};
