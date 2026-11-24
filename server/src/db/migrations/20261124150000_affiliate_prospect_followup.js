const { id, fk } = require("../helpers");

// Affiliates → Prospects: following a family up (24 Nov 2026).
//   - affiliate_prospect_notes: the team's follow-up notes on a prospect, oldest first, each with who
//     wrote it and when. Only the team sees them (the affiliate's own note stays on the prospect).
//     Deleted with the family's other details when a claim closes without a sign-up (expired,
//     released, lost, opted out — affiliate.prospects.js's wiped).
//   - affiliate_prospects.followUpOn: when to get back to the family (optional).
// New table: newer collation — never SQL-join it to older tables.
exports.up = async function up(knex) {
  if (!(await knex.schema.hasTable("affiliate_prospect_notes"))) {
    await knex.schema.createTable("affiliate_prospect_notes", (t) => {
      id(t);
      fk(t, "prospectId").notNullable();
      fk(t, "ownerAdminId").notNullable();
      fk(t, "authorUserId").nullable();
      t.string("authorName", 150).nullable();
      t.text("body").notNullable();
      t.datetime("createdAt").notNullable();
      t.index(["prospectId", "createdAt"]);
    });
  }
  if (!(await knex.schema.hasColumn("affiliate_prospects", "followUpOn"))) {
    await knex.schema.alterTable("affiliate_prospects", (t) => {
      t.date("followUpOn").nullable();
    });
  }
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists("affiliate_prospect_notes");
  if (await knex.schema.hasColumn("affiliate_prospects", "followUpOn")) {
    await knex.schema.alterTable("affiliate_prospects", (t) => t.dropColumn("followUpOn"));
  }
};
