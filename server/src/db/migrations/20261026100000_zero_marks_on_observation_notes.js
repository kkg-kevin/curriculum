// A Teacher Observation "note" item is now marked and tagged to competency indicators like every
// other observation item (grading.utils.js's computeMaxScore / computeIndicatorBreakdown). Until
// now a note was never scored, but every one was still saved with the builder's default of 1 mark
// that nobody could see. Counting those would quietly add a mark per note to each existing
// observation's total, so every existing note not tagged to an indicator is set to 0 marks. Its
// author can give it marks from now on.
//
// Submissions keep the maxScore they were created with, so no existing grade changes either way.
// Idempotent: a note already at 0 marks is left alone.

function parse(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === "string" && value) return JSON.parse(value);
  return [];
}

exports.up = async function up(knex) {
  const rows = await knex("assessments").where({ type: "observation" }).select("id", "indicators");
  for (const row of rows) {
    const indicators = parse(row.indicators);
    let changed = false;
    const next = indicators.map((entry) => {
      if (entry?.kind !== "note" || (entry.indicatorMarks || []).length > 0 || !entry.points) return entry;
      changed = true;
      return { ...entry, points: 0 };
    });
    if (changed) await knex("assessments").where({ id: row.id }).update({ indicators: JSON.stringify(next) });
  }
};

// Nothing to undo: a 0-mark note scores exactly as an unscored note did.
exports.down = async function down() {};
