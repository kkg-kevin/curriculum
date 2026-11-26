// Affiliates → Prospects, 26 Nov 2026:
//   - affiliateId may be empty: a family our team registers is the TEAM's prospect (no affiliate
//     earns from it, no claim clock — it stays until they sign up or ask not to be contacted),
//     and no affiliate can claim them while it's open.
//   - stage: where the conversation with the family stands — new | contacted | no_answer |
//     interested | visit_booked | later | not_interested (signed_up is set when they sign up).
//     stageAt / stageBy: the last change; stageHistory: every change [{ stage, at, by }].
// Existing prospects start as "new", those that signed up as "signed_up".
exports.up = async function up(knex) {
  await knex.raw("ALTER TABLE affiliate_prospects MODIFY affiliateId VARCHAR(36) NULL");
  if (!(await knex.schema.hasColumn("affiliate_prospects", "stage"))) {
    await knex.schema.alterTable("affiliate_prospects", (t) => {
      t.string("stage", 20).notNullable().defaultTo("new");
      t.datetime("stageAt").nullable();
      t.string("stageBy", 150).nullable();
      t.json("stageHistory").nullable();
    });
    await knex("affiliate_prospects").where({ status: "signed_up" }).update({ stage: "signed_up" });
  }
};

exports.down = async function down(knex) {
  if (await knex.schema.hasColumn("affiliate_prospects", "stage")) {
    await knex.schema.alterTable("affiliate_prospects", (t) => {
      t.dropColumn("stage");
      t.dropColumn("stageAt");
      t.dropColumn("stageBy");
      t.dropColumn("stageHistory");
    });
  }
};
