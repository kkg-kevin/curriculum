const { id, fk } = require("../helpers");

// Family credits (27 Nov 2026, modules/family-credits/). A parent buys credits (1 credit = KSh 1)
// for their children; any of their children can then book a mentor with them straight away, from
// their own login, without waiting for the parent. The parent can book with them too.
//   family_credit_wallets  one per parent login per workspace: the balance, what was bought and
//                          spent, and per-child rules (childRules JSON: { [learnerId]: { allowed,
//                          monthlyLimit } } — every child may book unless the parent switches it off)
//   family_credit_entries  the ledger: every purchase (a paid "credits" invoice), spend (paying a
//                          mentor booking's invoice), refund (a cancelled booking's credits back),
//                          and staff adjustment, each with the balance after it. `uniqueKey`
//                          (UNIQUE) makes each purchase / refund happen once however often it's run.
//   mentor_bookings.creditsUsed / bookedByRole  what of the booking was paid in credits, and whether
//                          the parent or the child booked it
//   billing_invoices.invoiceType + "credits"   the invoice a parent pays to buy credits
// New tables have a newer collation than the older ones — never SQL-join them to older tables.

const OLD_INVOICE_TYPES = ["hub_subscription", "learner_term", "course_module", "bootcamp", "hub_usage", "home_learning", "tech_club", "store_order", "pathway", "pathway_subscription", "mentor_booking", "competition"];
const NEW_INVOICE_TYPES = [...OLD_INVOICE_TYPES, "credits"];
const enumSql = (values) => values.map((v) => `'${v}'`).join(", ");

exports.up = async function up(knex) {
  await knex.raw(`ALTER TABLE billing_invoices MODIFY invoiceType ENUM(${enumSql(NEW_INVOICE_TYPES)}) NOT NULL`);

  if (!(await knex.schema.hasTable("family_credit_wallets"))) {
    await knex.schema.createTable("family_credit_wallets", (t) => {
      id(t);
      fk(t, "ownerAdminId").notNullable();
      fk(t, "parentUserId").notNullable();
      t.decimal("balance", 12, 2).notNullable().defaultTo(0);
      t.decimal("totalBought", 12, 2).notNullable().defaultTo(0);
      t.decimal("totalSpent", 12, 2).notNullable().defaultTo(0);
      t.json("childRules").nullable();
      t.datetime("createdAt").notNullable();
      t.datetime("updatedAt").nullable();
      t.unique(["ownerAdminId", "parentUserId"]);
      t.index("parentUserId");
    });
  }
  if (!(await knex.schema.hasTable("family_credit_entries"))) {
    await knex.schema.createTable("family_credit_entries", (t) => {
      id(t);
      fk(t, "walletId").notNullable();
      fk(t, "ownerAdminId").notNullable();
      t.string("kind", 20).notNullable(); // purchase | spend | refund | adjust
      t.decimal("amount", 12, 2).notNullable(); // + in, - out
      t.decimal("balanceAfter", 12, 2).notNullable();
      fk(t, "learnerId").nullable();
      fk(t, "invoiceId").nullable();
      fk(t, "bookingId").nullable();
      fk(t, "byUserId").nullable();
      t.string("byRole", 20).nullable(); // parent | child | staff | system
      t.string("note", 500).nullable();
      t.string("uniqueKey", 120).nullable();
      t.datetime("createdAt").notNullable();
      t.unique(["uniqueKey"]);
      t.index(["walletId", "createdAt"]);
      t.index("bookingId");
      t.index("invoiceId");
    });
  }
  if (!(await knex.schema.hasColumn("mentor_bookings", "creditsUsed"))) {
    await knex.schema.alterTable("mentor_bookings", (t) => {
      t.decimal("creditsUsed", 12, 2).notNullable().defaultTo(0);
      t.string("bookedByRole", 10).notNullable().defaultTo("parent");
    });
  }
};

exports.down = async function down(knex) {
  if (await knex.schema.hasColumn("mentor_bookings", "creditsUsed")) {
    await knex.schema.alterTable("mentor_bookings", (t) => { t.dropColumn("creditsUsed"); t.dropColumn("bookedByRole"); });
  }
  await knex.schema.dropTableIfExists("family_credit_entries");
  await knex.schema.dropTableIfExists("family_credit_wallets");
  await knex("billing_invoices").where({ invoiceType: "credits" }).update({ invoiceType: "learner_term" });
  await knex.raw(`ALTER TABLE billing_invoices MODIFY invoiceType ENUM(${enumSql(OLD_INVOICE_TYPES)}) NOT NULL`);
};
