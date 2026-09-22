// Second batch of description columns becoming rich text (TipTap HTML) — see
// 20260922090000_widen_curriculum_framework_descriptions_to_rich_text.js for the same reasoning.
// `pathway_templates` is listed since that's the current name — created as `learning_areas_catalog`,
// renamed by 20260903090000_rename_learning_areas_to_pathways.
const TARGETS = [
  ["curricula", "description"],
  ["learning_hubs", "description"],
  ["pathway_templates", "description"],
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
    curricula: 500,
    learning_hubs: 1000,
    pathway_templates: 500,
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
