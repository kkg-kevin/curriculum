// Marks are kept to one decimal place (see assessment.validation.js's markValue). Rounding a sum
// too keeps floating-point noise (3.3 + 3.3 + 3.4 = 9.999…) out of every total.
function roundMarks(value) {
  return Math.round((Number(value) || 0) * 10) / 10;
}

// A question/rubric-criterion's total is the sum of its per-indicator marks once any are
// tagged; otherwise it falls back to the plain `points` field (untagged entries).
function computeEntryMarks(entry) {
  if (entry?.indicatorMarks?.length) {
    return roundMarks(entry.indicatorMarks.reduce((sum, m) => sum + (Number(m.marks) || 0), 0));
  }
  return roundMarks(entry?.points);
}

// Rounds a question's per-indicator marks to one decimal place without changing the question's
// total: the last indicator absorbs the rounding difference, so an older 3.33 + 3.33 + 3.34 split
// (worth 10) becomes 3.3 + 3.3 + 3.4, not 9.9.
function roundIndicatorMarks(list) {
  if (!Array.isArray(list) || !list.length) return list;
  const total = roundMarks(list.reduce((sum, m) => sum + (Number(m.marks) || 0), 0));
  const rounded = list.map((m) => ({ ...m, marks: roundMarks(m.marks) }));
  const diff = roundMarks(total - rounded.reduce((sum, m) => sum + m.marks, 0));
  if (diff) {
    const last = rounded[rounded.length - 1];
    last.marks = Math.max(0, roundMarks(last.marks + diff));
  }
  return rounded;
}

module.exports = { computeEntryMarks, roundMarks, roundIndicatorMarks };
