const { id, fk, timestamps } = require("../helpers");

// Buying on the website — the Store's goods and for-sale Projects in one cart, paid through an
// invoice (see modules/orders/orders.service.js).
//
//   - orders: one checkout. Who's buying, how it reaches them (pickup at a hub, delivery, or
//     nothing to send when it's only project access), the totals fixed at checkout, its invoice,
//     and where it stands (awaiting_payment → paid → preparing → ready_for_pickup / dispatched →
//     completed, or cancelled). `history` is the status changes, newest last.
//   - order_items: the lines, with name and price fixed at checkout. kind: store_item, project
//     (access to a project assessment for the child named on the order), project_kit (that
//     project's materials kit).
//   - assessments: `gallery` — more photos for a for-sale project after its cover; `kitPriceAmount`
//     — the price of its materials kit when it's sold alongside (null = no kit offered).
//   - billing_invoices.invoiceType: + "store_order".
//   - billing_number_sequences.scope: + "order" (ORD-2026-000123).
//
// Additive only.
const INVOICE_TYPES = ["hub_subscription", "learner_term", "course_module", "bootcamp", "hub_usage", "home_learning", "tech_club"];

exports.up = async function up(knex) {
  if (!(await knex.schema.hasColumn("assessments", "gallery"))) {
    await knex.schema.alterTable("assessments", (t) => t.json("gallery").nullable());
  }
  if (!(await knex.schema.hasColumn("assessments", "kitPriceAmount"))) {
    await knex.schema.alterTable("assessments", (t) => t.decimal("kitPriceAmount", 12, 2).nullable());
  }

  const types = [...INVOICE_TYPES, "store_order"].map((t) => `'${t}'`).join(",");
  await knex.raw(`ALTER TABLE billing_invoices MODIFY COLUMN invoiceType ENUM(${types}) NOT NULL`);
  await knex.raw("ALTER TABLE billing_number_sequences MODIFY COLUMN scope ENUM('invoice','receipt','order') NOT NULL");

  if (!(await knex.schema.hasTable("orders"))) {
    await knex.schema.createTable("orders", (table) => {
      id(table);
      table.string("orderNumber", 30).notNullable().unique();
      fk(table, "ownerAdminId").nullable();
      table.string("status", 30).notNullable().defaultTo("awaiting_payment");
      table.string("customerName", 150).notNullable();
      table.string("customerEmail", 160).notNullable();
      table.string("customerPhone", 30).notNullable();
      // pickup | delivery | none (only project access — nothing to hand over)
      table.string("fulfilment", 20).notNullable();
      fk(table, "pickupHubId").nullable();
      table.string("deliveryAddress", 300).nullable();
      table.string("deliveryTown", 100).nullable();
      table.string("deliveryCounty", 100).nullable();
      table.string("deliveryNote", 500).nullable();
      table.decimal("subtotal", 12, 2).notNullable();
      table.decimal("deliveryFee", 12, 2).notNullable().defaultTo(0);
      table.decimal("total", 12, 2).notNullable();
      table.string("currency", 3).notNullable().defaultTo("KES");
      fk(table, "invoiceId").nullable();
      fk(table, "hubId").nullable();
      // Set when the order has projects: the parent's login and the child who gets them.
      fk(table, "parentUserId").nullable();
      fk(table, "learnerId").nullable();
      table.string("childName", 150).nullable();
      table.json("history").nullable();
      table.string("visitSource", 100).nullable();
      timestamps(table);
      table.index(["ownerAdminId", "status"]);
      table.index("invoiceId");
    });
  }

  if (!(await knex.schema.hasTable("order_items"))) {
    await knex.schema.createTable("order_items", (table) => {
      id(table);
      fk(table, "orderId").notNullable();
      table.string("kind", 20).notNullable();
      fk(table, "refId").notNullable();
      table.string("name", 200).notNullable();
      table.string("image", 500).nullable();
      table.decimal("unitPrice", 12, 2).notNullable();
      table.integer("quantity").notNullable().defaultTo(1);
      table.decimal("lineTotal", 12, 2).notNullable();
      timestamps(table, { updatedAt: false });
      table.index("orderId");
    });
  }
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists("order_items");
  await knex.schema.dropTableIfExists("orders");
  await knex("billing_number_sequences").where({ scope: "order" }).del();
  await knex.raw("ALTER TABLE billing_number_sequences MODIFY COLUMN scope ENUM('invoice','receipt') NOT NULL");
  await knex.raw(`ALTER TABLE billing_invoices MODIFY COLUMN invoiceType ENUM(${INVOICE_TYPES.map((t) => `'${t}'`).join(",")}) NOT NULL`);
  for (const column of ["kitPriceAmount", "gallery"]) {
    if (await knex.schema.hasColumn("assessments", column)) {
      await knex.schema.alterTable("assessments", (t) => t.dropColumn(column));
    }
  }
};
