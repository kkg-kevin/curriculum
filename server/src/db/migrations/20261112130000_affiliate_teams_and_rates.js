const { fk } = require("../helpers");

// Affiliate teams and rates of their own (12 Nov 2026 — modules/affiliates/):
//   affiliates.isManager            level 1: a manager — their own link and commissions as before, plus
//                                   a team share of what the families of the affiliates under them pay
//   affiliates.managerId            level 2 under a manager (null = on their own, as before). Two
//                                   levels only: a manager is never under another manager
//   affiliates.customRates          JSON { rates: { <programme>: % }, periods, teamRate } — this
//                                   affiliate's own deal; anything left out follows Settings
//   affiliate_commissions.kind      "own" (a family they referred) | "team" (a manager's share)
//                 sourceCommissionId  a team share: the affiliate's commission it came from
//                 fromAffiliateId     a team share: the affiliate under the manager
//   UNIQUE (invoiceId)  →  UNIQUE (invoiceId, affiliateId): one paid invoice now earns the
//                       affiliate's commission and their manager's share, each once.

exports.up = async function up(knex) {
  if (!(await knex.schema.hasColumn("affiliates", "isManager"))) {
    await knex.schema.alterTable("affiliates", (t) => {
      t.boolean("isManager").notNullable().defaultTo(false);
      fk(t, "managerId").nullable();
      t.json("customRates").nullable();
      t.index("managerId");
    });
  }
  if (!(await knex.schema.hasColumn("affiliate_commissions", "kind"))) {
    await knex.schema.alterTable("affiliate_commissions", (t) => {
      t.string("kind", 8).notNullable().defaultTo("own");
      fk(t, "sourceCommissionId").nullable();
      fk(t, "fromAffiliateId").nullable();
      t.index("sourceCommissionId");
    });
    await knex.schema.alterTable("affiliate_commissions", (t) => {
      t.dropUnique(["invoiceId"]);
      t.unique(["invoiceId", "affiliateId"]);
    });
  }
};

exports.down = async function down(knex) {
  if (await knex.schema.hasColumn("affiliate_commissions", "kind")) {
    await knex("affiliate_commissions").where({ kind: "team" }).del();
    await knex.schema.alterTable("affiliate_commissions", (t) => {
      t.dropUnique(["invoiceId", "affiliateId"]);
      t.unique(["invoiceId"]);
    });
    await knex.schema.alterTable("affiliate_commissions", (t) => {
      t.dropIndex("sourceCommissionId");
      t.dropColumn("kind");
      t.dropColumn("sourceCommissionId");
      t.dropColumn("fromAffiliateId");
    });
  }
  if (await knex.schema.hasColumn("affiliates", "isManager")) {
    await knex.schema.alterTable("affiliates", (t) => {
      t.dropIndex("managerId");
      t.dropColumn("isManager");
      t.dropColumn("managerId");
      t.dropColumn("customRates");
    });
  }
};
