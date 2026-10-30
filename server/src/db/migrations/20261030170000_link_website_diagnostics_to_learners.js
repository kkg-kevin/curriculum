// A website diagnostic becomes part of the learner's record once they enrol (30 Oct 2026).
//
//   assessment_issues.publicAttemptId   the website attempt (public_diagnostic_attempts.id) a
//                               learner's diagnostic was taken as — its issue (issuedBy "website")
//                               and marked submission are copied from that attempt, so its report,
//                               competencies and placement show on the profile like one taken in
//                               the portal. One per learner and attempt.
exports.up = async function up(knex) {
  if (!(await knex.schema.hasColumn("assessment_issues", "publicAttemptId"))) {
    await knex.schema.alterTable("assessment_issues", (table) => {
      table.string("publicAttemptId", 36).nullable();
      table.index("publicAttemptId");
    });
  }
};

exports.down = async function down(knex) {
  if (await knex.schema.hasColumn("assessment_issues", "publicAttemptId")) {
    await knex.schema.alterTable("assessment_issues", (table) => {
      table.dropIndex("publicAttemptId");
      table.dropColumn("publicAttemptId");
    });
  }
};
