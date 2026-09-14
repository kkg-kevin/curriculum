const { fk } = require("../helpers");

// A "collaborator" is a dedicated login (its own email/password, same as curriculumAdmin) that
// an admin invites into their own tenant to help author content — curricula, courses,
// assessments, hubs, bootcamps, competitions, settings. Unlike curriculumAdmin (one delegate,
// scoped to a single curriculum via curricula.curriculumAdminId), a collaborator gets edit access
// across the WHOLE inviting admin's tenant, and an admin can invite many of them — so this is a
// column on users pointing at the admin, not a column on one content table pointing at the user.
// See scope.middleware.js's attachOwnRecords, which resolves a collaborator's req.ownerAdminId to
// invitedByAdminId rather than their own id, so every existing ownerAdminId-scoped read/write
// keeps working unchanged. A collaborator can never delete or manage other collaborators — see
// auth.middleware.js's blockIfCollaboratorRestricted.
exports.up = async function up(knex) {
  await knex.schema.alterTable("users", (table) => {
    table.enu("role", ["admin", "school", "teacher", "learner", "curriculumAdmin", "collaborator"]).notNullable().alter();
  });
  await knex.schema.alterTable("users", (table) => {
    fk(table, "invitedByAdminId").nullable();
    table.index("invitedByAdminId");
  });
};

exports.down = async function down(knex) {
  await knex.schema.alterTable("users", (table) => {
    table.dropIndex("invitedByAdminId");
    table.dropColumn("invitedByAdminId");
  });
  await knex.schema.alterTable("users", (table) => {
    table.enu("role", ["admin", "school", "teacher", "learner", "curriculumAdmin"]).notNullable().alter();
  });
};
