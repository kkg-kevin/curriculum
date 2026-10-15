// How the family first found the website, on every lead the website creates — the first page
// they opened, the site that sent them (google.com, facebook.com…) and any utm_* campaign tags.
// The website keeps it in the visitor's browser and sends it with the form (X-Visit-Source
// header, see modules/leads/visit-source.js); the Enquiries page shows it, so search and campaign
// work can be judged by the enquiries it brings. null = a lead from before this, or the visitor's
// browser had nothing to send.
//
// Idempotent (hasColumn guard) so a re-run or partial rollback is safe.
exports.up = async function up(knex) {
  if (!(await knex.schema.hasColumn("leads", "visitSource"))) {
    await knex.schema.alterTable("leads", (table) => {
      table.json("visitSource").nullable();
    });
  }
};

exports.down = async function down(knex) {
  if (await knex.schema.hasColumn("leads", "visitSource")) {
    await knex.schema.alterTable("leads", (table) => {
      table.dropColumn("visitSource");
    });
  }
};
