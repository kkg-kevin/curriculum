const { fk } = require("../helpers");

// Claim supervisors — a login whose only job is reviewing the claims of the educators assigned
// to it.
//
// A supervisor is a `users` row with role "supervisor", belonging to the admin who created it
// (invitedByAdminId, the same column a staff account uses). An educator optionally points at one
// (teachers.supervisorId). That changes a claim's path:
//
//   educator has a supervisor   pending_supervisor → approved → paid   (the admin only pays)
//   educator has none           pending_admin      → approved → paid   (the admin approves, then pays)
//
// A claim keeps the supervisor it was sent to (teacher_claims.supervisorId, set when it is
// submitted), so reassigning an educator later doesn't move claims already in review.
const ROLES = ["admin", "school", "teacher", "learner", "curriculumAdmin", "collaborator"];

exports.up = async function up(knex) {
  await knex.schema.alterTable("users", (table) => {
    table.enu("role", [...ROLES, "supervisor"]).notNullable().alter();
  });
  if (!(await knex.schema.hasColumn("teachers", "supervisorId"))) {
    await knex.schema.alterTable("teachers", (table) => {
      fk(table, "supervisorId").nullable();
      table.index("supervisorId");
    });
  }
  // Under the earlier flow a supervisor's approval sent a claim on to the admin for a second
  // approval. That second approval is gone: anything a supervisor already approved is ready to pay.
  await knex("teacher_claims").where({ status: "pending_admin" }).whereNotNull("supervisorDecidedAt").update({ status: "approved" });
};

exports.down = async function down(knex) {
  if (await knex.schema.hasColumn("teachers", "supervisorId")) {
    await knex.schema.alterTable("teachers", (table) => {
      table.dropIndex("supervisorId");
      table.dropColumn("supervisorId");
    });
  }
  // Supervisor accounts can't exist without the role — remove them before narrowing the enum
  // (MySQL would otherwise blank their role rather than fail).
  await knex("users").where({ role: "supervisor" }).del();
  await knex.schema.alterTable("users", (table) => {
    table.enu("role", ROLES).notNullable().alter();
  });
};
