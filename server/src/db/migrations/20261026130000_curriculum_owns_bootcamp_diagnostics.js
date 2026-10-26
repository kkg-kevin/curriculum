// Diagnostics now live only in the curriculum. Each pathway stage has two:
//   - diagnosticAssessmentId        the learner diagnostic, issued once a learner is enrolled (any type)
//   - publicDiagnosticAssessmentId  the website diagnostic, auto-graded only; offered exactly when set
// Until now the website could "reuse" the learner one (publicDiagnosticEnabled on, no website
// assessment of its own), and a website assessment could sit there switched off. Both become the
// one rule: a stage offers a website diagnostic exactly when publicDiagnosticAssessmentId is set.
//   - switched on, reusing the learner one → that assessment becomes its website diagnostic (it was
//     already checked to be auto-graded when it was switched on)
//   - switched off, with a website assessment → the website assessment is cleared
//
// Bootcamps no longer pick diagnostics of their own: bootcamps.pathwayDiagnostics is dropped. Its
// choices never reached anyone — the website always served the pathway's own diagnostic, and
// enrolled learners were always issued the curriculum's — so nothing anyone sees changes.

exports.up = async function up(knex) {
  await knex("pathways")
    .where({ publicDiagnosticEnabled: true })
    .whereNull("publicDiagnosticAssessmentId")
    .whereNotNull("diagnosticAssessmentId")
    .update({ publicDiagnosticAssessmentId: knex.ref("diagnosticAssessmentId") });
  await knex("pathways").where({ publicDiagnosticEnabled: true }).whereNull("publicDiagnosticAssessmentId").update({ publicDiagnosticEnabled: false });
  await knex("pathways").where({ publicDiagnosticEnabled: false }).whereNotNull("publicDiagnosticAssessmentId").update({ publicDiagnosticAssessmentId: null });

  if (await knex.schema.hasColumn("bootcamps", "pathwayDiagnostics")) {
    await knex.schema.alterTable("bootcamps", (t) => t.dropColumn("pathwayDiagnostics"));
  }
};

// The pathways rows aren't put back (the old "reuse" form says the same thing); the bootcamp
// column comes back empty.
exports.down = async function down(knex) {
  if (!(await knex.schema.hasColumn("bootcamps", "pathwayDiagnostics"))) {
    await knex.schema.alterTable("bootcamps", (t) => t.json("pathwayDiagnostics").nullable());
  }
};
