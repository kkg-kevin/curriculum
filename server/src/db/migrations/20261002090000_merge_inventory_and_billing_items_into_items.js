// One Items catalog (Settings → Items), with every item either Goods or a Service:
//   - `inventory` (physical materials — linked onto Courses/Project assessments with a quantity,
//     and sold in the website Store) is renamed to `items`; its rows become kind "goods". Ids are
//     untouched, so course_inventory_links / assessment_inventory_links keep pointing at them.
//   - `billing_items` (the invoice form's price list) rows move in as kind "service", same ids.
//     Nothing referenced billing_items by id (invoices copy name/price when an item is picked),
//     so the table is then dropped.
//   - Goods gain the invoice fields too (defaultPrice, invoiceType) so they can be billed.
//
// invoiceType becomes a plain string validated in code (items.validation.js reuses billing's
// invoiceTypes). billing_items had it as a 4-value MySQL enum that never gained hub_usage /
// home_learning even though validation allowed them.
exports.up = async function up(knex) {
  await knex.schema.renameTable("inventory", "items");

  await knex.schema.alterTable("items", (t) => {
    t.enu("kind", ["goods", "service"]).notNullable().defaultTo("goods");
    t.decimal("defaultPrice", 12, 2).nullable();
    t.string("invoiceType", 30).nullable();
    t.index(["ownerAdminId", "kind"]);
  });

  const services = await knex("billing_items").select("*");
  for (const s of services) {
    await knex("items").insert({
      id: s.id,
      kind: "service",
      name: s.name,
      description: s.description,
      defaultPrice: s.defaultPrice,
      unit: s.unit || "item",
      invoiceType: s.invoiceType,
      ownerAdminId: s.ownerAdminId,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
      // Goods-only columns: a service has no category/image and is never sold in the Store.
      category: null,
      image: null,
      saleStatus: "internal",
    });
  }

  await knex.schema.dropTable("billing_items");
};

exports.down = async function down(knex) {
  await knex.schema.createTable("billing_items", (t) => {
    t.string("id", 36).primary();
    t.string("name", 150).notNullable();
    t.text("description").nullable();
    t.decimal("defaultPrice", 12, 2).nullable();
    t.string("unit", 30).notNullable().defaultTo("item");
    t.enu("invoiceType", ["hub_subscription", "learner_term", "course_module", "bootcamp"]).nullable();
    t.datetime("createdAt").notNullable();
    t.datetime("updatedAt").nullable();
    t.string("ownerAdminId", 36).notNullable();
    t.index("ownerAdminId");
  });

  const legacyInvoiceTypes = new Set(["hub_subscription", "learner_term", "course_module", "bootcamp"]);
  const services = await knex("items").where({ kind: "service" });
  for (const s of services) {
    await knex("billing_items").insert({
      id: s.id,
      name: s.name,
      description: s.description,
      defaultPrice: s.defaultPrice,
      unit: s.unit || "item",
      invoiceType: legacyInvoiceTypes.has(s.invoiceType) ? s.invoiceType : null,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
      ownerAdminId: s.ownerAdminId,
    });
  }
  await knex("items").where({ kind: "service" }).del();

  // Goods lose their invoice price/type here — inventory never had them.
  await knex.schema.alterTable("items", (t) => {
    t.dropIndex(["ownerAdminId", "kind"]);
    t.dropColumn("kind");
    t.dropColumn("defaultPrice");
    t.dropColumn("invoiceType");
  });
  await knex.schema.renameTable("items", "inventory");
};
