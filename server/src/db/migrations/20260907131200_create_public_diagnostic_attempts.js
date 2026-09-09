const { id, fk, timestamps } = require("../helpers");

// One row per anonymous website visitor's completed public diagnostic — see
// public-diagnostic.service.js. Deliberately NOT assessment_submissions: that table requires a
// real, enrolled learnerId (notNullable) and grading it unconditionally attempts a competency
// placement write against a real learners row (CompetencyService.placeLearner, no fallback for
// a missing learner). An anonymous visitor has no learner record and never will for this
// attempt — trying to force one through assessment_submissions would mean fabricating a
// throwaway learner/enrollment per attempt, polluting the real tenant data model this
// system otherwise keeps carefully scoped. This table sidesteps that by construction: an
// attempt is graded and written in a single step, no draft state, no manual-grading wait
// (public diagnostics are auto-graded only — see competency.validation.js's guard), and it
// never transitions status the way a submission does.
exports.up = async function up(knex) {
  await knex.schema.createTable("public_diagnostic_attempts", (table) => {
    id(table);
    fk(table, "pathwayId").notNullable(); // the operational pathways.id, not pathway_templates
    fk(table, "assessmentId").notNullable();
    fk(table, "leadId").notNullable(); // -> leads.id, written in the same request (see lead.service.js's submitLead reuse)
    table.integer("childAge").notNullable();
    table.string("childName", 150).nullable();
    table.json("answers").notNullable();
    table.float("totalScore").notNullable();
    table.float("maxScore").notNullable();
    table.json("indicatorBreakdown").nullable();
    // Hashed, never the raw IP — abuse-pattern visibility (e.g. "one IP, many attempts") without
    // storing anything that identifies a specific visitor on its own.
    table.string("ipHash", 64).nullable();
    timestamps(table, { updatedAt: false });
    table.index("pathwayId");
    table.index("leadId");
    table.index("createdAt");
  });
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists("public_diagnostic_attempts");
};
