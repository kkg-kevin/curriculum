// Which of a curriculum's evidence types an assessment counts as (17 Nov 2026).
//
//   1. Its own tag (assessments.evidenceType — an evidence type's name) when this curriculum has an
//      evidence type of that name (case and spacing ignored).
//   2. Otherwise "automatic": the curriculum's evidence type whose category matches the
//      assessment's type — when exactly one does.
//   3. Otherwise none, with the reason — two evidence types share that category, or none has it.
//
// Used by Curriculum coverage (analytics.coverage.js). Scoring (assessment-submission.service.js)
// still matches by category alone.

const norm = (s) => String(s || "").trim().replace(/\s+/g, " ").toLowerCase();

// Never counted as evidence.
const NOT_EVIDENCE = new Set(["survey"]);

function resolveEvidenceType(assessment, evidenceTypes) {
  if (!assessment || NOT_EVIDENCE.has(assessment.type)) return { evidenceType: null, reason: "not_evidence" };
  if (assessment.evidenceType) {
    const named = evidenceTypes.find((et) => norm(et.name) === norm(assessment.evidenceType));
    if (named) return { evidenceType: named, reason: "tagged" };
  }
  const byCategory = evidenceTypes.filter((et) => et.category && et.category === assessment.type);
  if (byCategory.length === 1) return { evidenceType: byCategory[0], reason: "automatic" };
  return {
    evidenceType: null,
    reason: byCategory.length > 1 ? "ambiguous" : assessment.evidenceType ? "tag_not_here" : "no_match",
    candidates: byCategory.map((et) => et.name),
  };
}

module.exports = { resolveEvidenceType, NOT_EVIDENCE };
