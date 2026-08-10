// Missed in the original schema pass — assessment-submission.service.js reads/writes
// submission.indicatorBreakdown (58 of 65 real rows have it), but no column was created for it.
exports.up = async function up(knex) {
  await knex.schema.alterTable("assessment_submissions", (table) => {
    table.json("indicatorBreakdown").nullable();
  });
};

exports.down = async function down(knex) {
  await knex.schema.alterTable("assessment_submissions", (table) => {
    table.dropColumn("indicatorBreakdown");
  });
};
