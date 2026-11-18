const { id, fk } = require("../helpers");

// Expenses (modules/expenses/, 18 Nov 2026): people who work for the organisation — admins, staff,
// educators (mentors) and supervisors — claiming back money they spent from their own pocket on
// its work (transport, fuel, a coffee at a school meeting, materials for a home-schooling visit).
//   - expense_claims: one per trip or purpose ("Visit to X school, 18 Nov"), owned by the person
//     who spent the money (claimantUserId), in the workspace (ownerAdminId) that pays it back.
//     draft → pending_supervisor | pending_admin → approved → paid, or returned (back to the
//     claimant to change and send again) / rejected. `timeline` is every step, shown on the claim.
//   - expense_items: the lines of a claim — date, category, amount, who was paid, what for, an
//     optional M-Pesa transaction code — each with its own approval (a line can be turned down
//     while the rest are paid).
//   - expense_files: the proof — receipt photos, M-Pesa screenshots, PDFs. Kept privately (never
//     under the public /uploads address) and only shown to the claimant and whoever reviews or
//     pays the claim. `sha256` finds the same file sent twice.
//   - expense_settings: one row per workspace — categories with an optional most-per-expense, the
//     amount below which a line may go without proof, and how many days people have to claim.
// New tables have a newer collation than the older ones — never SQL-join them to older tables.
exports.up = async function up(knex) {
  if (!(await knex.schema.hasTable("expense_claims"))) {
    await knex.schema.createTable("expense_claims", (table) => {
      id(table);
      fk(table, "ownerAdminId").notNullable();
      fk(table, "claimantUserId").notNullable();
      // The sign-in it was made from: admin | collaborator | teacher | supervisor — decides who
      // reviews it and where its links open.
      table.string("claimantRole", 20).notNullable();
      table.string("claimantName", 150).nullable();
      table.string("claimantEmail", 255).nullable();
      table.string("claimantPhone", 40).nullable();
      fk(table, "teacherId").nullable();
      table.string("number", 20).nullable(); // EXP-0001, given when first sent
      table.string("title", 200).notNullable();
      table.text("purpose").nullable();
      fk(table, "hubId").nullable(); // the learning hub / school the money was spent for
      table.string("hubName", 200).nullable();
      table.string("currency", 8).notNullable().defaultTo("KES");
      table.decimal("totalAmount", 12, 2).notNullable().defaultTo(0);
      table.decimal("approvedAmount", 12, 2).nullable();
      table.string("status", 24).notNullable().defaultTo("draft");
      fk(table, "supervisorId").nullable(); // the supervisor it was sent to (an educator's)
      table.string("supervisorName", 150).nullable();
      table.datetime("supervisorDecidedAt").nullable();
      fk(table, "adminDecidedBy").nullable();
      table.string("adminName", 150).nullable();
      table.datetime("adminDecidedAt").nullable();
      table.boolean("selfApproved").notNullable().defaultTo(false);
      table.text("rejectionReason").nullable();
      table.text("returnReason").nullable();
      table.datetime("declaredAt").nullable();
      table.datetime("firstSubmittedAt").nullable();
      table.datetime("submittedAt").nullable();
      table.datetime("paidAt").nullable();
      fk(table, "paidBy").nullable();
      table.string("paidByName", 150).nullable();
      table.string("paymentMethod", 20).nullable(); // mpesa | bank | cash | other
      table.string("paymentReference", 120).nullable();
      table.text("paymentNote").nullable();
      table.json("timeline").nullable();
      table.datetime("createdAt").notNullable();
      table.datetime("updatedAt").nullable();
      table.index("ownerAdminId");
      table.index("claimantUserId");
      table.index("supervisorId");
      table.index("status");
    });
  }
  if (!(await knex.schema.hasTable("expense_items"))) {
    await knex.schema.createTable("expense_items", (table) => {
      id(table);
      fk(table, "claimId").notNullable();
      fk(table, "ownerAdminId").notNullable();
      table.integer("position").notNullable().defaultTo(0);
      table.date("spentOn").notNullable();
      table.string("category", 40).notNullable();
      table.string("description", 500).notNullable();
      table.string("vendor", 200).nullable();
      table.decimal("amount", 12, 2).notNullable();
      table.string("mpesaCode", 20).nullable();
      table.string("noReceiptReason", 500).nullable();
      table.string("status", 20).notNullable().defaultTo("open"); // open | rejected
      table.string("rejectionReason", 500).nullable();
      table.datetime("createdAt").notNullable();
      table.datetime("updatedAt").nullable();
      table.index("claimId");
      table.index(["ownerAdminId", "mpesaCode"]);
      table.index(["ownerAdminId", "spentOn"]);
    });
  }
  if (!(await knex.schema.hasTable("expense_files"))) {
    await knex.schema.createTable("expense_files", (table) => {
      id(table);
      fk(table, "ownerAdminId").nullable();
      fk(table, "uploadedBy").notNullable();
      fk(table, "claimId").nullable(); // null until it is saved on a claim
      fk(table, "itemId").nullable();
      table.string("storedName", 80).notNullable();
      table.string("filename", 255).notNullable();
      table.string("mimeType", 120).notNullable();
      table.integer("size").notNullable();
      table.string("sha256", 64).notNullable();
      // Taken off a claim after it had been sent: kept, so a reviewer still sees what was there.
      table.datetime("removedAt").nullable();
      table.datetime("createdAt").notNullable();
      table.index("claimId");
      table.index("itemId");
      table.index(["ownerAdminId", "sha256"]);
      table.index("uploadedBy");
    });
  }
  if (!(await knex.schema.hasTable("expense_settings"))) {
    await knex.schema.createTable("expense_settings", (table) => {
      id(table);
      fk(table, "ownerAdminId").notNullable();
      table.json("categories").nullable();
      table.decimal("noReceiptLimit", 12, 2).notNullable().defaultTo(500);
      table.integer("submitWithinDays").notNullable().defaultTo(30);
      table.string("currency", 8).notNullable().defaultTo("KES");
      table.datetime("createdAt").notNullable();
      table.datetime("updatedAt").nullable();
      table.unique(["ownerAdminId"]);
    });
  }
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists("expense_settings");
  await knex.schema.dropTableIfExists("expense_files");
  await knex.schema.dropTableIfExists("expense_items");
  await knex.schema.dropTableIfExists("expense_claims");
};
