const { fk } = require("../helpers");

// Public anonymous diagnostic feature, extended to Bootcamps — mirrors
// 20260907131100_add_public_diagnostic_enabled_to_pathways.js exactly, but on `bootcamps`
// instead of `pathways`. A bootcamp isn't a pathway (it links to a curriculum via curriculumId,
// which may contain zero/one/many pathways — see bootcamp.model.js), so it needs its own
// diagnosticAssessmentId/publicDiagnosticEnabled rather than borrowing a pathway's. Reuses the
// bootcamp's own EXISTING ageMin/ageMax columns (added when bootcamps was created) instead of
// adding a second age range — same "one diagnostic, one set of gating fields" posture pathways
// already has. Defaults false/null everywhere — nothing is publicly reachable until an admin
// explicitly opts a bootcamp in (see bootcamp.service.js's save-time guard, mirroring
// competency.service.js's assertPublicDiagnosticAllowed).
exports.up = async function up(knex) {
  await knex.schema.alterTable("bootcamps", (table) => {
    fk(table, "diagnosticAssessmentId").nullable();
    table.boolean("publicDiagnosticEnabled").notNullable().defaultTo(false);
  });
};

exports.down = async function down(knex) {
  await knex.schema.alterTable("bootcamps", (table) => {
    table.dropColumn("diagnosticAssessmentId");
    table.dropColumn("publicDiagnosticEnabled");
  });
};
