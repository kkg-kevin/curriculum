// Settings → Pathways → On the website → Picture: the image the website shows on a pathway's card
// and page. Optional — without one the website uses the pathway's first course cover.
// Idempotent (hasColumn guard).
exports.up = async function up(knex) {
  if (await knex.schema.hasColumn("pathway_templates", "websiteImage")) return;
  await knex.schema.alterTable("pathway_templates", (t) => {
    t.string("websiteImage", 500).nullable();
  });
};

exports.down = async function down(knex) {
  if (await knex.schema.hasColumn("pathway_templates", "websiteImage")) {
    await knex.schema.alterTable("pathway_templates", (t) => t.dropColumn("websiteImage"));
  }
};
