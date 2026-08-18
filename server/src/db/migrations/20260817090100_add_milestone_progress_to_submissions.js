// Per-milestone grading progress for a project assessment's submission — independent of the
// submission's own status/totalScore (which continue to track the learner's own deliverable
// upload flow, unchanged). A teacher grades milestones one at a time, directly on the
// submission (auto-created on first grade, same as Teacher Observation's start flow), and each
// entry is visible to the learner the moment it's saved — see assessment-submission.service.js's
// gradeMilestone.
exports.up = async function up(knex) {
  await knex.schema.alterTable("assessment_submissions", (table) => {
    table.json("milestoneProgress").nullable();
  });
};

exports.down = async function down(knex) {
  await knex.schema.alterTable("assessment_submissions", (table) => {
    table.dropColumn("milestoneProgress");
  });
};
