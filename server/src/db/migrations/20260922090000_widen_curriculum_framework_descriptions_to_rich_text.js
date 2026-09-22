// These description columns are becoming rich text (TipTap HTML) — the client now saves markup
// through them, not plain sentences, so the old varchar caps (500/1000 chars) are far too tight
// once tags are counted. Widen each to a plain `text` column (~64KB), matching how
// courses.description / assessments.description already store their own rich-text HTML.
// Idempotent (checks table+column existence) so a re-run / partial rollback is safe. `learning_areas`
// is listed since that's the table name at the migration that created this column — a later
// migration (20260903090000) renamed it to `pathways`, so by the time this runs the table is
// found under its new name instead.
const TARGETS = [
  ["age_categories", "description"],
  ["assessment_types", "description"],
  ["evidence_types", "description"],
  ["pathways", "description"], // created as `learning_areas`, renamed by 20260903090000_rename_learning_areas_to_pathways
  ["performance_bands", "description"],
];

exports.up = async function up(knex) {
  for (const [table, column] of TARGETS) {
    const hasTable = await knex.schema.hasTable(table);
    if (!hasTable) continue;
    const hasCol = await knex.schema.hasColumn(table, column);
    if (hasCol) {
      await knex.schema.alterTable(table, (t) => t.text(column).nullable().alter());
    }
  }
};

exports.down = async function down(knex) {
  // Reverting to varchar would truncate any rich text saved in the meantime — data-lossy by
  // nature, so this is a best-effort narrowing back rather than a guaranteed-safe rollback.
  const CAPS = {
    age_categories: 500,
    assessment_types: 1000,
    evidence_types: 500,
    pathways: 500,
    performance_bands: 1000,
  };
  for (const [table, column] of TARGETS) {
    const hasTable = await knex.schema.hasTable(table);
    if (!hasTable) continue;
    const hasCol = await knex.schema.hasColumn(table, column);
    if (hasCol) {
      await knex.schema.alterTable(table, (t) => t.string(column, CAPS[table]).nullable().alter());
    }
  }
};
