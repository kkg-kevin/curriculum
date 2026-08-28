// One-time backfill for Progress-Arc-purpose bands (learningAreaId null) that predate the
// ageCategoryId column. If a curriculum has EXACTLY ONE Developmental Stage, every one of its
// stage-less bands unambiguously belongs to that stage — assign it and re-sequence `order` 1..N
// (its old curriculum-wide order numbers may have had gaps once Learning-Journey bands are
// excluded). If a curriculum has zero or multiple stages, the correct target can't be inferred —
// leave those bands with ageCategoryId null rather than guessing wrong; they're surfaced to
// admins via a "legacy bands need a stage" affordance in PerformanceBandsPanel instead.
exports.up = async function up(knex) {
  const curricula = await knex("curricula").select("id");
  for (const { id: curriculumId } of curricula) {
    const stages = await knex("age_categories").where({ curriculumId });
    const staleBands = await knex("performance_bands")
      .where({ curriculumId })
      .whereNull("learningAreaId")
      .whereNull("ageCategoryId");
    if (staleBands.length === 0 || stages.length !== 1) continue;

    const stageId = stages[0].id;
    const ordered = [...staleBands].sort((a, b) => a.order - b.order);
    for (let i = 0; i < ordered.length; i++) {
      await knex("performance_bands").where({ id: ordered[i].id }).update({ ageCategoryId: stageId, order: i + 1 });
    }
  }
};

exports.down = async function down(knex) {
  // Not meaningfully reversible — which bands were auto-assigned vs. already unassigned isn't
  // tracked separately. No-op, matching this repo's convention for backfill migrations.
};
