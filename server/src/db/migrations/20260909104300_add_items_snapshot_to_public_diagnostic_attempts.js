// The public diagnostic report is now viewable at a permanent shareable link
// (GET /api/public/diagnostics/attempts/:attemptId — see public-diagnostic.service.js). To
// render that page identically to the on-submit report — question text, per-question "your
// answer", the same order — the page needs the exact SANITIZED item set the visitor saw, not
// the live assessment (which an admin may edit, reorder, or delete questions from afterwards).
//
// `answers` was already stored; this adds the matching SANITIZED item snapshot (question text +
// kind + options, no answer key) so the pair is self-contained and the report's per-question
// section never drifts from what was actually taken. `itemResults` (the per-item correct/marks
// outcome, already computed at grade time) is stored too — it must NOT be re-derived from the
// snapshot, because sanitizeItem shuffles `sequence` and blanks `blanks`/`pairs.right`, so
// re-grading the snapshot would be wrong for ordering/matching/fillBlank.
//
// Both nullable — pre-existing attempt rows have neither and their standalone report falls back
// to score + competency breakdown only (no per-question section).
exports.up = async function up(knex) {
  const hasSnapshot = await knex.schema.hasColumn("public_diagnostic_attempts", "itemsSnapshot");
  const hasResults = await knex.schema.hasColumn("public_diagnostic_attempts", "itemResults");
  await knex.schema.alterTable("public_diagnostic_attempts", (table) => {
    if (!hasSnapshot) table.json("itemsSnapshot").nullable();
    if (!hasResults) table.json("itemResults").nullable();
  });
};

exports.down = async function down(knex) {
  const hasSnapshot = await knex.schema.hasColumn("public_diagnostic_attempts", "itemsSnapshot");
  const hasResults = await knex.schema.hasColumn("public_diagnostic_attempts", "itemResults");
  await knex.schema.alterTable("public_diagnostic_attempts", (table) => {
    if (hasSnapshot) table.dropColumn("itemsSnapshot");
    if (hasResults) table.dropColumn("itemResults");
  });
};
