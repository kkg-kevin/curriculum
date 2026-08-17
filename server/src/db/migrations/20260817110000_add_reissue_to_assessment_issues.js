const { fk } = require("../helpers");

// A teacher reissuing a graded assessment to one learner (see
// AssessmentSubmissionService.reissueToLearner) creates a brand new standalone issue rather than
// resetting the original graded submission — that keeps the original grade/feedback intact as a
// permanent record instead of overwriting it. This column links the new issue back to the one it
// was reissued from, so the learner side can look up and show the prior attempt's feedback as
// guidance, and so a teacher can trace a reissue back to its origin.
exports.up = async function up(knex) {
  await knex.schema.alterTable("assessment_issues", (table) => {
    fk(table, "reissuedFromIssueId").nullable();
    table.index("reissuedFromIssueId");
  });
};

exports.down = async function down(knex) {
  await knex.schema.alterTable("assessment_issues", (table) => {
    table.dropColumn("reissuedFromIssueId");
  });
};
