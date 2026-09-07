const { fk } = require("../helpers");

// Multi-tenant admin isolation, phase 1: each admin is its own tenant. ownerAdminId marks who
// created/owns a learning_hubs, curricula, courses, or assessments row — these four are the
// true "root" entities an admin authors directly; everything else (classes, programs, rooms,
// billing_invoices via hubId; the curriculum-framework tables via curriculumId) inherits scoping
// transitively through one of these four, so it needs no owner column of its own. Global
// taxonomies (system_levels, competencies, pathway_templates, inventory) are deliberately left
// unscoped — they have no per-tenant variation, same posture as before this migration.
//
// Nullable first (existing rows have none yet) — backfilled below in this same up(), then a
// later migration flips these to notNullable once the backfill is confirmed clean in every
// environment (see 20260907090100_make_owner_admin_id_not_nullable.js).
exports.up = async function up(knex) {
  for (const table of ["learning_hubs", "curricula", "courses", "assessments"]) {
    await knex.schema.alterTable(table, (t) => {
      fk(t, "ownerAdminId").nullable();
      t.index("ownerAdminId");
    });
  }

  // Backfill: every environment today has exactly one admin (see server/src/scripts/seedAdmin.js
  // / server/src/server.js's ensureAdmin() — both "create the first/only admin if missing", and
  // there is no product flow yet that creates a second one). Assign every existing row to that
  // one admin so nothing is left ownerless. If no admin exists yet (a brand-new, unmigrated-until-
  // now database), there's nothing to own — skip the backfill, the app's own boot-time
  // ensureAdmin() creates the first admin before any of these tables would be written to anyway.
  const admin = await knex("users").where({ role: "admin" }).orderBy("createdAt", "asc").first();
  if (admin) {
    for (const table of ["learning_hubs", "curricula", "courses", "assessments"]) {
      await knex(table).whereNull("ownerAdminId").update({ ownerAdminId: admin.id });
    }
  }
};

exports.down = async function down(knex) {
  for (const table of ["learning_hubs", "curricula", "courses", "assessments"]) {
    await knex.schema.alterTable(table, (t) => {
      t.dropIndex("ownerAdminId");
      t.dropColumn("ownerAdminId");
    });
  }
};
