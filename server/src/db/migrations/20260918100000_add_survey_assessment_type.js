// New assessment type: "survey" - an ungraded self-reflection where a learner rates their own
// understanding of a concept on a scale (see assessment.validation.js/builder.constants.js).
// Never scored (grading.utils.js's requiresManualGrading/computeMaxScore both short-circuit for
// it) but its questions can still be tagged to competency indicators via the existing
// assessment_competency_links join table, same as every other type.
//
// Knex's schema builder can't alter a MySQL enum's allowed values in place, so this uses a raw
// ALTER TABLE ... MODIFY. Idempotent-safe to re-run (MODIFY is not additive-only, but re-running
// the same MODIFY is a no-op).
const OLD_VALUES = ["quiz", "exam", "project", "assignment", "observation"];
const NEW_VALUES = [...OLD_VALUES, "survey"];

function enumSql(values) {
  return values.map((v) => `'${v}'`).join(", ");
}

exports.up = async function up(knex) {
  await knex.raw(`ALTER TABLE assessments MODIFY type ENUM(${enumSql(NEW_VALUES)}) NOT NULL`);
};

exports.down = async function down(knex) {
  // Any existing survey assessments would need to be reassigned or removed before this can run
  // cleanly - MySQL truncates values not in the target ENUM list to '' rather than failing loudly.
  await knex.raw(`ALTER TABLE assessments MODIFY type ENUM(${enumSql(OLD_VALUES)}) NOT NULL`);
};
