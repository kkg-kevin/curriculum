// Settings → Pathways decides which pathways the website shows and at which hubs each runs —
// kept on the workspace's pathway catalogue entry (one per pathway name):
//   websiteVisible — shown on the website. Starts TRUE for every entry, so the website keeps
//                    showing exactly what it shows today until someone switches one off.
//   websiteHubIds  — the hubs it runs at (JSON array); the website lists them and the family picks
//                    one when they enrol. Empty = no hubs chosen yet (the enrol form then offers
//                    every hub, as before).
// Idempotent (hasColumn guards).
exports.up = async function up(knex) {
  const hasVisible = await knex.schema.hasColumn("pathway_templates", "websiteVisible");
  const hasHubs = await knex.schema.hasColumn("pathway_templates", "websiteHubIds");
  if (hasVisible && hasHubs) return;
  await knex.schema.alterTable("pathway_templates", (t) => {
    if (!hasVisible) t.boolean("websiteVisible").notNullable().defaultTo(true);
    if (!hasHubs) t.json("websiteHubIds").nullable();
  });
};

exports.down = async function down(knex) {
  for (const column of ["websiteVisible", "websiteHubIds"]) {
    if (await knex.schema.hasColumn("pathway_templates", column)) {
      await knex.schema.alterTable("pathway_templates", (t) => t.dropColumn(column));
    }
  }
};
