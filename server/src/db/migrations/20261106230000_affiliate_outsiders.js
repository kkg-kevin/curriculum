// Affiliates who aren't users of the system (modules/affiliates/, 6 Nov 2026):
//   - dashboardVersion: their private dashboard link (no sign-in) is signed with it; "Make a new
//     link" raises it, so every older link stops working.
//   - source: how they became an affiliate — admin (added by staff), portal (joined from Refer &
//     earn), website (applied on the website's "Become an affiliate" page).
//   - promotion: how they said they'd share Digifunzi (website applications).
//   - termsAcceptedAt: when they agreed to the affiliate terms (website applications).
exports.up = async function up(knex) {
  const has = (column) => knex.schema.hasColumn("affiliates", column);
  if (!(await has("dashboardVersion"))) await knex.schema.alterTable("affiliates", (t) => t.integer("dashboardVersion").notNullable().defaultTo(1));
  if (!(await has("source"))) await knex.schema.alterTable("affiliates", (t) => t.string("source", 20).notNullable().defaultTo("admin"));
  if (!(await has("promotion"))) await knex.schema.alterTable("affiliates", (t) => t.text("promotion").nullable());
  if (!(await has("termsAcceptedAt"))) await knex.schema.alterTable("affiliates", (t) => t.datetime("termsAcceptedAt").nullable());
};

exports.down = async function down(knex) {
  for (const column of ["termsAcceptedAt", "promotion", "source", "dashboardVersion"]) {
    if (await knex.schema.hasColumn("affiliates", column)) await knex.schema.alterTable("affiliates", (t) => t.dropColumn(column));
  }
};
