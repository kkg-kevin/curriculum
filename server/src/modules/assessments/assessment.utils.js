// A question/rubric-criterion's total is the sum of its per-indicator marks once any are
// tagged; otherwise it falls back to the plain `points` field (untagged entries).
function computeEntryMarks(entry) {
  if (entry?.indicatorMarks?.length) {
    return entry.indicatorMarks.reduce((sum, m) => sum + (Number(m.marks) || 0), 0);
  }
  return Number(entry?.points) || 0;
}

module.exports = { computeEntryMarks };
