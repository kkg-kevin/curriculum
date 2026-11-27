// Expenses say what they were for (27 Nov 2026, expenses/expense.links.js). Each line of a claim
// can be linked to the record the money was spent on — a Home Learning family, a class, a hub, a
// bootcamp, an event, a QA visit, a mentor session… — so whoever reviews, pays or later looks at
// that record sees what it cost and who spent it.
//   expense_items.linkType   the kind of record (expense.links.js's TYPES), or "general" for work
//                            not tied to one record
//   expense_items.linkId     the record's id (null for "general")
//   expense_items.linkLabel  its name when linked, kept so the line still reads after a rename or
//                            removal
//   expense_settings.requireLink  sending a claim needs every line to say what it was for
exports.up = async function up(knex) {
  const add = async (table, column, build) => {
    if (!(await knex.schema.hasColumn(table, column))) await knex.schema.alterTable(table, build);
  };
  await add("expense_items", "linkType", (t) => { t.string("linkType", 30).nullable(); });
  await add("expense_items", "linkId", (t) => { t.string("linkId", 36).nullable(); });
  await add("expense_items", "linkLabel", (t) => { t.string("linkLabel", 255).nullable(); });
  await add("expense_settings", "requireLink", (t) => { t.boolean("requireLink").notNullable().defaultTo(false); });
  const indexes = await knex.raw("SHOW INDEX FROM expense_items WHERE Key_name = 'expense_items_link_index'");
  if (!indexes[0].length) {
    await knex.schema.alterTable("expense_items", (t) => { t.index(["ownerAdminId", "linkType", "linkId"], "expense_items_link_index"); });
  }
};

exports.down = async function down(knex) {
  await knex.schema.alterTable("expense_items", (t) => {
    t.dropIndex(["ownerAdminId", "linkType", "linkId"], "expense_items_link_index");
    t.dropColumn("linkType");
    t.dropColumn("linkId");
    t.dropColumn("linkLabel");
  });
  await knex.schema.alterTable("expense_settings", (t) => { t.dropColumn("requireLink"); });
};
