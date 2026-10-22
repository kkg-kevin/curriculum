const { id, fk, timestamps } = require("../helpers");

// M-Pesa phases 4–5 — see Guide/MPESA_INTEGRATION_PLAN.md.
//
//   - mpesa_accounts: a workspace's own Paybill (Settings → Payments). A workspace without one
//     keeps using the installation's Paybill from .env. Secrets are stored encrypted with
//     MPESA_SECRETS_KEY (see mpesa.secrets.js); `callbackToken` is this account's part of the
//     callback URLs, so Safaricom's calls say which Paybill they're about.
//   - accountId on mpesa_stk_requests / mpesa_transactions: which Paybill a prompt was sent from
//     or a payment arrived in. Null = the installation's (every row made before this migration).
//   - payment_links: a one-time link to pay one invoice without signing in — the website's
//     "Pay now" at the end of a sign-up. Only a hash of the token is kept.
//   - mpesa_operations: calls whose answer Safaricom sends later, to a result URL: paying an
//     educator's claim (B2C, kind "payout"), checking a transaction ("status") and reversing one
//     ("reversal").
//
// Additive only — no existing row changes.
exports.up = async function up(knex) {
  if (!(await knex.schema.hasTable("mpesa_accounts"))) {
    await knex.schema.createTable("mpesa_accounts", (table) => {
      id(table);
      fk(table, "ownerAdminId").notNullable().unique();
      table.boolean("enabled").notNullable().defaultTo(true);
      table.string("environment", 20).notNullable().defaultTo("sandbox");
      table.string("shortcode", 20).notNullable();
      table.string("accountLabel", 100).nullable();
      table.text("consumerKey").nullable();
      table.text("consumerSecret").nullable();
      table.text("passkey").nullable();
      table.string("callbackToken", 64).notNullable().unique();
      // The Paybill's API operator ("initiator"), for checking and reversing its transactions.
      table.string("initiatorName", 100).nullable();
      table.text("securityCredential").nullable();
      // Paying educators (B2C) goes out of a separate disbursement shortcode, usually with its own
      // Daraja app and operator. Each left empty falls back to the Paybill's.
      table.string("b2cShortcode", 20).nullable();
      table.text("b2cConsumerKey").nullable();
      table.text("b2cConsumerSecret").nullable();
      table.string("b2cInitiatorName", 100).nullable();
      table.text("b2cSecurityCredential").nullable();
      table.datetime("c2bRegisteredAt").nullable();
      table.json("c2bRegisterResult").nullable();
      fk(table, "updatedBy").nullable();
      timestamps(table);
    });
  }

  for (const tableName of ["mpesa_stk_requests", "mpesa_transactions"]) {
    if (!(await knex.schema.hasColumn(tableName, "accountId"))) {
      await knex.schema.alterTable(tableName, (table) => {
        fk(table, "accountId").nullable();
        table.index("accountId");
      });
    }
  }

  if (!(await knex.schema.hasTable("payment_links"))) {
    await knex.schema.createTable("payment_links", (table) => {
      id(table);
      table.string("tokenHash", 64).notNullable().unique();
      fk(table, "invoiceId").notNullable();
      table.string("purpose", 40).notNullable();
      table.datetime("expiresAt").notNullable();
      table.datetime("lastUsedAt").nullable();
      timestamps(table, { updatedAt: false });
      table.index("invoiceId");
    });
  }

  if (!(await knex.schema.hasTable("mpesa_operations"))) {
    await knex.schema.createTable("mpesa_operations", (table) => {
      id(table);
      fk(table, "ownerAdminId").nullable();
      fk(table, "accountId").nullable();
      table.string("kind", 20).notNullable();
      table.string("status", 20).notNullable().defaultTo("pending");
      fk(table, "claimId").nullable();
      fk(table, "transactionId").nullable();
      table.string("transId", 40).nullable();
      table.string("phone", 15).nullable();
      table.decimal("amount", 12, 2).nullable();
      table.string("originatorConversationId", 100).nullable().unique();
      table.string("conversationId", 100).nullable();
      table.string("resultCode", 20).nullable();
      table.string("resultDesc", 255).nullable();
      table.string("receiptNumber", 40).nullable();
      table.string("receiverName", 150).nullable();
      table.json("result").nullable();
      fk(table, "requestedBy").nullable();
      timestamps(table);
      table.index(["kind", "status"]);
      table.index("claimId");
      table.index("transactionId");
      table.index("conversationId");
      table.index("ownerAdminId");
    });
  }
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists("mpesa_operations");
  await knex.schema.dropTableIfExists("payment_links");
  for (const tableName of ["mpesa_transactions", "mpesa_stk_requests"]) {
    if (await knex.schema.hasColumn(tableName, "accountId")) {
      await knex.schema.alterTable(tableName, (table) => {
        table.dropIndex("accountId");
        table.dropColumn("accountId");
      });
    }
  }
  await knex.schema.dropTableIfExists("mpesa_accounts");
};
