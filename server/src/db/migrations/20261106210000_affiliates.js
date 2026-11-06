const { id, fk } = require("../helpers");

// Affiliate marketing (modules/affiliates/, 6 Nov 2026): people who send families to the website
// earn a share of what those families pay.
//   - affiliates: one per person (a parent or educator login, or someone with no login the admin
//     manages), with their code (?ref=CODE on any website link, or typed at sign-up), status
//     (pending → active, or suspended) and how they're paid (invoice credit, M-Pesa, bank).
//   - affiliate_referrals: one per sign-up an affiliate brought in (a Home Learning household, a
//     Tech Club membership, a pathway subscription, a bootcamp enrolment's invoice, a shop order) —
//     UNIQUE (programme, recordId), so one sign-up is credited once.
//   - affiliate_commissions: one per PAID invoice of a referred sign-up (UNIQUE invoiceId), up to
//     the workspace's number of periods; held until `availableAt`, then paid out.
//   - affiliate_payouts: a request (the affiliate's or an admin's) for the commissions available,
//     paid by M-Pesa / bank / cash (a reference typed in) or as credit on one of their invoices.
//   - affiliate_settings: one row per workspace — programmes, rates, periods, hold days, minimum.
// New tables have a newer collation than the older ones — never SQL-join them to older tables.
exports.up = async function up(knex) {
  if (!(await knex.schema.hasTable("affiliates"))) {
    await knex.schema.createTable("affiliates", (table) => {
      id(table);
      fk(table, "ownerAdminId").notNullable();
      fk(table, "userId").nullable();
      table.string("name", 150).notNullable();
      table.string("email", 255).nullable();
      table.string("phone", 40).nullable();
      table.string("kind", 20).notNullable().defaultTo("other"); // parent | educator | other
      table.string("code", 24).notNullable();
      table.string("status", 20).notNullable().defaultTo("active"); // pending | active | suspended
      table.string("payoutMethod", 20).notNullable().defaultTo("mpesa"); // credit | mpesa | bank
      table.string("payoutPhone", 40).nullable();
      table.string("payoutDetails", 500).nullable();
      table.text("notes").nullable();
      fk(table, "createdBy").nullable();
      table.datetime("createdAt").notNullable();
      table.datetime("updatedAt").nullable();
      table.unique(["code"]);
      table.index("ownerAdminId");
      table.index("userId");
    });
  }
  if (!(await knex.schema.hasTable("affiliate_referrals"))) {
    await knex.schema.createTable("affiliate_referrals", (table) => {
      id(table);
      fk(table, "ownerAdminId").notNullable();
      fk(table, "affiliateId").notNullable();
      table.string("via", 10).notNullable(); // link | code
      table.string("programme", 20).notNullable(); // home_learning | tech_club | pathway | bootcamp | shop
      fk(table, "recordId").notNullable();
      fk(table, "invoiceId").nullable();
      fk(table, "parentUserId").nullable();
      table.string("parentEmail", 255).nullable();
      table.string("parentPhone", 40).nullable();
      table.string("customerName", 150).nullable();
      table.string("detail", 255).nullable();
      table.string("landingPage", 300).nullable();
      table.string("status", 20).notNullable().defaultTo("signed_up"); // signed_up | paid | cancelled
      table.datetime("firstPaidAt").nullable();
      table.datetime("createdAt").notNullable();
      table.datetime("updatedAt").nullable();
      table.unique(["programme", "recordId"]);
      table.index("affiliateId");
      table.index("ownerAdminId");
      table.index("invoiceId");
    });
  }
  if (!(await knex.schema.hasTable("affiliate_commissions"))) {
    await knex.schema.createTable("affiliate_commissions", (table) => {
      id(table);
      fk(table, "ownerAdminId").notNullable();
      fk(table, "affiliateId").notNullable();
      fk(table, "referralId").notNullable();
      fk(table, "invoiceId").notNullable();
      table.string("invoiceNumber", 40).nullable();
      table.integer("periodNumber").notNullable().defaultTo(1);
      table.decimal("baseAmount", 12, 2).notNullable();
      table.decimal("ratePercent", 5, 2).notNullable();
      table.decimal("amount", 12, 2).notNullable();
      table.string("currency", 3).notNullable().defaultTo("KES");
      table.string("status", 20).notNullable().defaultTo("pending"); // pending | paid | cancelled
      table.datetime("availableAt").notNullable();
      fk(table, "payoutId").nullable();
      table.string("note", 500).nullable();
      table.datetime("createdAt").notNullable();
      table.datetime("updatedAt").nullable();
      table.unique(["invoiceId"]);
      table.index("affiliateId");
      table.index("referralId");
      table.index("payoutId");
    });
  }
  if (!(await knex.schema.hasTable("affiliate_payouts"))) {
    await knex.schema.createTable("affiliate_payouts", (table) => {
      id(table);
      fk(table, "ownerAdminId").notNullable();
      fk(table, "affiliateId").notNullable();
      table.decimal("amount", 12, 2).notNullable();
      table.string("currency", 3).notNullable().defaultTo("KES");
      table.string("method", 20).notNullable(); // credit | mpesa | bank | cash
      table.string("status", 20).notNullable().defaultTo("requested"); // requested | paid | rejected
      table.string("reference", 120).nullable();
      fk(table, "creditInvoiceId").nullable();
      table.string("note", 500).nullable();
      fk(table, "requestedBy").nullable();
      fk(table, "decidedBy").nullable();
      table.datetime("decidedAt").nullable();
      table.datetime("createdAt").notNullable();
      table.datetime("updatedAt").nullable();
      table.index("affiliateId");
      table.index("ownerAdminId");
      table.index("status");
    });
  }
  if (!(await knex.schema.hasTable("affiliate_settings"))) {
    await knex.schema.createTable("affiliate_settings", (table) => {
      table.string("ownerAdminId", 36).primary();
      table.json("settings").notNullable();
      table.datetime("updatedAt").nullable();
    });
  }
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists("affiliate_settings");
  await knex.schema.dropTableIfExists("affiliate_payouts");
  await knex.schema.dropTableIfExists("affiliate_commissions");
  await knex.schema.dropTableIfExists("affiliate_referrals");
  await knex.schema.dropTableIfExists("affiliates");
};
