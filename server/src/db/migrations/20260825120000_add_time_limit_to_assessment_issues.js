// A teacher-set optional duration limit for one issuance — e.g. "this exam is due Friday, but
// once a learner opens it they have 2 hours." Nullable/opt-in, same posture as dueDate right next
// to it: an issue with no time limit imposes no restriction (see assessment-submission.service.js's
// isExpired). The clock starts from the submission's own createdAt (already stamped the instant
// getOrCreateSubmission first creates it) rather than a separate startedAt column — saving a draft
// and resuming later never resets or pauses it, matching "the time will keep going" exactly.
exports.up = async function up(knex) {
  await knex.schema.alterTable("assessment_issues", (table) => {
    table.integer("timeLimitMinutes").unsigned().nullable();
  });
};

exports.down = async function down(knex) {
  await knex.schema.alterTable("assessment_issues", (table) => {
    table.dropColumn("timeLimitMinutes");
  });
};
