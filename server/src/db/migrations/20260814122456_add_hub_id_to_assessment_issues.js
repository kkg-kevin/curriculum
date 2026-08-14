const { fk } = require("../helpers");

// A standalone diagnostic issue (see assessment-submission.service.js's issueDiagnostic) needs
// to remember which hub it was issued at, so grading it can write the resulting stage/band
// placement back onto the correct hub enrollment (see CompetencyService.placeLearnerFromDiagnostic
// and assessment-submission.service.js's maybePlaceFromDiagnostic, both of which already read
// issue.hubId). That column was never actually added to the table — every diagnostic issuance
// (e.g. enrolling a learner into a class whose age category has a configured diagnostic) has
// been failing with "Unknown column 'hubId' in field list" since this code shipped.
exports.up = async function up(knex) {
  await knex.schema.alterTable("assessment_issues", (table) => {
    fk(table, "hubId").nullable();
    table.index("hubId");
  });
};

exports.down = async function down(knex) {
  await knex.schema.alterTable("assessment_issues", (table) => {
    table.dropColumn("hubId");
  });
};
