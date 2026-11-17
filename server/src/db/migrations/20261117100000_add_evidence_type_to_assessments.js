// Which evidence type an assessment counts as (17 Nov 2026) — for the minimum-evidence tracking in
// Reports & Analytics → Curriculum coverage. Stored as the evidence type's NAME, not its id:
// assessments are a shared library (no curriculumId) and evidence types belong to each curriculum,
// so the name is what one tag can match in every curriculum that uses the assessment.
// Empty (every existing assessment) means "automatic": it counts as the curriculum's one evidence
// type with the same category as its type (project → the "project" evidence type), when there is
// exactly one. See shared/utils/evidence-types.js.
//
// Idempotent (hasColumn guard) so a re-run / partial rollback is safe.
exports.up = async function up(knex) {
  if (await knex.schema.hasColumn("assessments", "evidenceType")) return;
  await knex.schema.alterTable("assessments", (t) => {
    t.string("evidenceType", 150).nullable();
  });
};

exports.down = async function down(knex) {
  if (!(await knex.schema.hasColumn("assessments", "evidenceType"))) return;
  await knex.schema.alterTable("assessments", (t) => {
    t.dropColumn("evidenceType");
  });
};
