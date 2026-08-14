// Links an issue/submission to a class_groups row for group-based assessments. groupMode is
// set at issue time (see assessment-submission.service.js's issueAssessment); groupId on a
// submission marks it as one of N sibling rows (one per group member) kept in lockstep by the
// submission service's fan-out logic, rather than a single shared row — see the plan this
// implements for why (it keeps the existing UNIQUE(issueId, learnerId) invariant intact).
exports.up = async function up(knex) {
  await knex.schema.alterTable("assessment_issues", (table) => {
    table.boolean("groupMode").notNullable().defaultTo(false);
  });
  await knex.schema.alterTable("assessment_submissions", (table) => {
    table.string("groupId", 36).nullable();
    table.index("groupId");
  });
};

exports.down = async function down(knex) {
  await knex.schema.alterTable("assessment_submissions", (table) => {
    table.dropColumn("groupId");
  });
  await knex.schema.alterTable("assessment_issues", (table) => {
    table.dropColumn("groupMode");
  });
};
