const { fk } = require("../helpers");

// Multi-tenant admin isolation, phase 1 continued: the "global taxonomy" tables (competencies,
// pathway_templates, system_levels, inventory, billing_items) were originally left unscoped on
// the reasoning that a taxonomy value means the same thing for every tenant. That reasoning was
// overridden — every admin's system must start genuinely empty, no shared catalogs either — so
// these five now get the same ownerAdminId column as learning_hubs/curricula/courses/assessments.
//
// leads is deliberately NOT included here: a lead arrives through an unauthenticated public form
// with no admin context at submission time, so there is no reliable way to attribute one to a
// single tenant (see lead.service.js's _notifyAdmins, which already fans out to every admin by
// design) — it stays platform-wide.
//
// Nullable first, backfilled to the sole existing admin (same reasoning/assumption as
// 20260907090000_add_owner_admin_id_to_root_tables.js — see that migration's comment), then a
// later migration flips these to notNullable.
exports.up = async function up(knex) {
  for (const table of ["competencies", "pathway_templates", "system_levels", "inventory", "billing_items"]) {
    await knex.schema.alterTable(table, (t) => {
      fk(t, "ownerAdminId").nullable();
      t.index("ownerAdminId");
    });
  }

  const admin = await knex("users").where({ role: "admin" }).orderBy("createdAt", "asc").first();
  if (admin) {
    for (const table of ["competencies", "pathway_templates", "system_levels", "inventory", "billing_items"]) {
      await knex(table).whereNull("ownerAdminId").update({ ownerAdminId: admin.id });
    }
  }
};

exports.down = async function down(knex) {
  for (const table of ["competencies", "pathway_templates", "system_levels", "inventory", "billing_items"]) {
    await knex.schema.alterTable(table, (t) => {
      t.dropIndex("ownerAdminId");
      t.dropColumn("ownerAdminId");
    });
  }
};
