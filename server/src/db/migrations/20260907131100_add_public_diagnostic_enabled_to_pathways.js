// Public anonymous diagnostic feature (see Guide/WEBSITE_INTEGRATION_CONTRACT.md once updated) —
// a pathway's diagnostic (diagnosticAssessmentId, already on this table) can optionally be
// offered to anonymous website visitors, not just enrolled learners. Piggybacks on the existing
// FK rather than adding a second publicDiagnosticAssessmentId — one pathway's diagnostic either
// can be offered publicly or can't; there's no product need for a different assessment publicly
// vs. internally. Defaults false everywhere — nothing is publicly reachable until an admin
// explicitly opts a pathway in (see competency.validation.js's save-time guard: this can only be
// set true if the referenced assessment is fully auto-gradable).
exports.up = async function up(knex) {
  await knex.schema.alterTable("pathways", (table) => {
    table.boolean("publicDiagnosticEnabled").notNullable().defaultTo(false);
  });
};

exports.down = async function down(knex) {
  await knex.schema.alterTable("pathways", (table) => {
    table.dropColumn("publicDiagnosticEnabled");
  });
};
