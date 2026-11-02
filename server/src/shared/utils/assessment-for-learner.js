const crypto = require("crypto");

// An assessment as a learner (or a parent watching) receives it: the questions without their
// answers — the same idea as the website diagnostic's sanitizeItem (public-diagnostic.service.js).
// Marking always happens on the server against the stored assessment, so nothing a learner needs
// to answer, or to read their results, goes missing:
//   - correctAnswer — the right option(s), true/false, or a written question's model answer — removed;
//   - blanks (fill in the blank) — each accepted answer blanked, keeping how many blanks there are;
//   - sequence (ordering) — shuffled: stored in the correct order, it would start out solved;
//   - pairs (matching) — the right-hand side blanked, with every right-hand option kept in
//     `rightOptions`, shuffled, for the picker.
// Shuffles are fixed per question (seeded by its id), so the order doesn't jump about each time
// the page reloads.

function seededShuffle(list, seed) {
  const keyed = list.map((value, i) => ({
    value,
    key: crypto.createHash("md5").update(`${seed}:${i}:${value}`).digest("hex"),
  }));
  const shuffled = keyed.sort((a, b) => a.key.localeCompare(b.key)).map((k) => k.value);
  // Never hand back the correct order itself when there's more than one entry.
  if (shuffled.length > 1 && shuffled.every((v, i) => v === list[i])) shuffled.push(shuffled.shift());
  return shuffled;
}

function learnerSafeItem(item) {
  if (!item || typeof item !== "object") return item;
  const { correctAnswer, ...clean } = item; // eslint-disable-line no-unused-vars
  const seed = item.id || item.prompt || "";
  if (Array.isArray(item.blanks)) clean.blanks = item.blanks.map(() => "");
  if (Array.isArray(item.sequence)) clean.sequence = seededShuffle(item.sequence, seed);
  if (Array.isArray(item.pairs)) {
    clean.pairs = item.pairs.map((p) => ({ left: p?.left, right: "" }));
    clean.rightOptions = seededShuffle(item.pairs.map((p) => p?.right), seed);
  }
  return clean;
}

// Items can sit at the top level or inside sections — both are cleaned.
function learnerSafeAssessment(assessment) {
  if (!assessment || typeof assessment !== "object") return assessment;
  const safe = { ...assessment };
  if (Array.isArray(assessment.items)) safe.items = assessment.items.map(learnerSafeItem);
  if (Array.isArray(assessment.sections)) {
    safe.sections = assessment.sections.map((s) => (s && Array.isArray(s.items) ? { ...s, items: s.items.map(learnerSafeItem) } : s));
  }
  return safe;
}

// A row carrying an `assessment` (issued list, diagnostics) with that assessment cleaned.
function withLearnerSafeAssessment(row) {
  return row && row.assessment ? { ...row, assessment: learnerSafeAssessment(row.assessment) } : row;
}

module.exports = { learnerSafeItem, learnerSafeAssessment, withLearnerSafeAssessment };
