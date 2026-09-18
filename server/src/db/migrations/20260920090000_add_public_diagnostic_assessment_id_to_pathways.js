const { fk } = require("../helpers");

// A Pathway can now offer a DIFFERENT diagnostic to anonymous public-website visitors than the
// one auto-issued internally to enrolled learners (diagnosticAssessmentId) — previously the same
// single assessment was reused for both audiences whenever publicDiagnosticEnabled was on. Left
// null (the default), the public flow falls back to reusing diagnosticAssessmentId exactly as it
// did before this column existed — this is purely additive, no existing behavior changes until an
// admin explicitly sets it. Nullable at the DB level, same posture as diagnosticAssessmentId
// itself; "must be a resolvable, auto-gradable assessment before publicDiagnosticEnabled can be
// true" is enforced at the Zod/service layer (see competency.service.js's
// assertPublicDiagnosticAllowed), not here.
//
// Idempotent (hasColumn guard) so a re-run / partial rollback is safe.
exports.up = async function up(knex) {
  const present = await knex.schema.hasColumn("pathways", "publicDiagnosticAssessmentId");
  if (!present) {
    await knex.schema.alterTable("pathways", (t) => fk(t, "publicDiagnosticAssessmentId").nullable());
  }
};

exports.down = async function down(knex) {
  const present = await knex.schema.hasColumn("pathways", "publicDiagnosticAssessmentId");
  if (present) {
    await knex.schema.alterTable("pathways", (t) => t.dropColumn("publicDiagnosticAssessmentId"));
  }
};
