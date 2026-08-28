// Makes a Developmental Stage a structural twin of a Performance Band: its own
// advancementThreshold, competencyIds (which competencies it draws on), and
// indicatorContributions (per-indicator % weight toward its own 100%) — same shape as the
// performance_bands columns of the same names. Computed the same way (Engine 4,
// runIndicatorProgressEngine) but purely for display alongside a learner's real Progress Arc —
// it never gates level advancement itself; only a Performance Band's own indicatorContributions
// does that (see CompetenciesPage.jsx's AgeCategoriesPanel / scoring-engines.js).
//
// ADDENDUM (later reverted): the read/write side of this described above was reverted — a
// Developmental Stage is authored as plain name/description/minAge/maxAge again (see
// AgeCategoriesPanel and competency.validation.js's ageCategoryFields). These columns remain in
// the schema (unused) since a migration is historical record, not live documentation.
exports.up = async function up(knex) {
  await knex.schema.alterTable("age_categories", (table) => {
    table.integer("advancementThreshold").notNullable().defaultTo(0);
    table.json("competencyIds").nullable();
    table.json("indicatorContributions").nullable();
  });
};

exports.down = async function down(knex) {
  await knex.schema.alterTable("age_categories", (table) => {
    table.dropColumn("advancementThreshold");
    table.dropColumn("competencyIds");
    table.dropColumn("indicatorContributions");
  });
};
