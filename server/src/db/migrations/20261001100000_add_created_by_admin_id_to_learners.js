const { fk } = require("../helpers");

// A learner's tenant has always been derived purely from its hub links (see learner.controller.js's
// isLinkedToOwnHub) — so a learner an admin creates from the top-level Learners page, with no hub
// picked yet, belonged to no tenant at all: the create succeeded, then the profile it redirected to
// 403'd ("Learner not found") and the learner never appeared in the admin's list either, with no
// way to reach it to assign a hub. createdByAdminId records the creating admin's tenant
// (req.ownerAdminId — the inviting admin for a collaborator), so the creator keeps access even
// before the first hub link exists. Nullable: school-created and website-created learners are
// always hub-linked at creation and scope through that link exactly as before.
exports.up = async function up(knex) {
  await knex.schema.alterTable("learners", (table) => {
    fk(table, "createdByAdminId").nullable();
    table.index("createdByAdminId");
  });

  // Backfill only the learners this bug already stranded (no hub link at all), and only when
  // there's exactly one admin, so the owner is unambiguous. With several admins there's no record
  // of who created an orphan — those stay unowned rather than being guessed into the wrong tenant.
  const admins = await knex("users").where({ role: "admin" }).select("id");
  if (admins.length === 1) {
    await knex("learners")
      .whereNull("createdByAdminId")
      .whereNotExists(knex("learner_hub_links").whereRaw("learner_hub_links.learnerId = learners.id"))
      .update({ createdByAdminId: admins[0].id });
  }
};

exports.down = async function down(knex) {
  await knex.schema.alterTable("learners", (table) => {
    table.dropIndex("createdByAdminId");
    table.dropColumn("createdByAdminId");
  });
};
