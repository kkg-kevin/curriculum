const { fk } = require("../helpers");

// Same gap as learners (see 20261001100000_add_created_by_admin_id_to_learners.js): a teacher's
// tenant was derived purely from its hub links (teacher.controller.js's isLinkedToOwnHub), so an
// educator an admin created with no hub picked belonged to no tenant — the create succeeded, then
// the profile it redirected to 403'd ("Teacher not found") and the educator never showed in the
// admin's list. createdByAdminId records the creating admin's tenant (req.ownerAdminId — the
// inviting admin for a collaborator) so the creator keeps access before the first hub link exists.
exports.up = async function up(knex) {
  await knex.schema.alterTable("teachers", (table) => {
    fk(table, "createdByAdminId").nullable();
    table.index("createdByAdminId");
  });

  // Backfill only already-stranded teachers (no hub link), and only when the owner is unambiguous.
  const admins = await knex("users").where({ role: "admin" }).select("id");
  if (admins.length === 1) {
    await knex("teachers")
      .whereNull("createdByAdminId")
      .whereNotExists(knex("teacher_hub_links").whereRaw("teacher_hub_links.teacherId = teachers.id"))
      .update({ createdByAdminId: admins[0].id });
  }
};

exports.down = async function down(knex) {
  await knex.schema.alterTable("teachers", (table) => {
    table.dropIndex("createdByAdminId");
    table.dropColumn("createdByAdminId");
  });
};
