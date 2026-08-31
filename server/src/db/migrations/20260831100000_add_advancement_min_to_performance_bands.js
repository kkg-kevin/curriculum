// A Performance Band's advancement bar is now a range, not a single number. The existing
// `advancementThreshold` column keeps its exact meaning and name — it's the MAX: a learner
// whose Engine 4 completion reaches it advances to the next band (see runIndicatorProgressEngine's
// `thresholdMet`). This adds `advancementMin`, the lower end of the range: a display-only "on
// track / approaching" marker between it and the max. It gates nothing — only the max moves a
// learner — so no scoring-engine behavior changes for existing data (every band gets min 0).
//
// Nullable-at-DB / required-at-Zod is not needed here: unlike ageCategoryId, a Learning-Journey
// band (learningAreaId + courseId set) can carry advancementMin harmlessly — it's just ignored,
// same as advancementThreshold already is for those. Plain NOT NULL DEFAULT 0, matching the
// original advancementThreshold column added in 20260807120004_curriculum_framework.js.
exports.up = async function up(knex) {
  await knex.schema.alterTable("performance_bands", (table) => {
    table.float("advancementMin").notNullable().defaultTo(0);
  });
};

exports.down = async function down(knex) {
  await knex.schema.alterTable("performance_bands", (table) => {
    table.dropColumn("advancementMin");
  });
};
