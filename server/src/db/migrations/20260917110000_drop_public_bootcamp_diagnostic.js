// The whole-bootcamp public diagnostic (one diagnosticAssessmentId/publicDiagnosticEnabled pair
// for the entire bootcamp) has been replaced by a diagnostic PER PATHWAY within a bootcamp (see
// bootcamps.pathwayDiagnostics, 20260917100000_add_pathway_diagnostics_to_bootcamps.js) — a
// bootcamp is no longer offered a single quiz, each of its pathways gets its own. Drops the
// columns and table added by 20260914130000_add_public_diagnostic_to_bootcamps.js and
// 20260914130100_create_public_bootcamp_diagnostic_attempts.js; the code that read/wrote them
// (public-bootcamp-diagnostic.service.js and friends) has been deleted alongside this migration.
exports.up = async function up(knex) {
  await knex.schema.dropTableIfExists("public_bootcamp_diagnostic_attempts");
  await knex.schema.alterTable("bootcamps", (table) => {
    table.dropColumn("diagnosticAssessmentId");
    table.dropColumn("publicDiagnosticEnabled");
  });
};

// Recreates the schema (empty) so a rollback is possible, but any attempt data that existed
// before the drop is gone for good — this down() does not restore rows.
exports.down = async function down(knex) {
  const { id, fk, timestamps } = require("../helpers");
  await knex.schema.alterTable("bootcamps", (table) => {
    table.string("diagnosticAssessmentId", 36).nullable();
    table.boolean("publicDiagnosticEnabled").notNullable().defaultTo(false);
  });
  await knex.schema.createTable("public_bootcamp_diagnostic_attempts", (table) => {
    id(table);
    fk(table, "bootcampId").notNullable();
    fk(table, "assessmentId").notNullable();
    fk(table, "leadId").nullable();
    table.integer("childAge").notNullable();
    table.string("childName", 150).nullable();
    table.json("answers").notNullable();
    table.json("itemsSnapshot").nullable();
    table.json("itemResults").nullable();
    table.float("totalScore").notNullable();
    table.float("maxScore").notNullable();
    table.json("indicatorBreakdown").nullable();
    table.string("ipHash", 64).nullable();
    timestamps(table, { updatedAt: false });
    table.index("bootcampId");
    table.index("leadId");
    table.index("createdAt");
  });
};
