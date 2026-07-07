/**
 * Pure scoring engine functions — no side effects, no DB access.
 * Each engine takes data in and returns computed results.
 * Can be tested independently and reused across service methods.
 */

/**
 * Engine 1 — Assessment Engine
 * Computes weighted score per evidence and overall final score.
 *
 * @param {Array<{evidenceTypeId, score}>} evidenceScores  Learner scores per evidence
 * @param {Array}                          evidenceConfig   Assessment type's evidenceWeights array
 * @returns {{ finalScore, breakdown, belowReq }}
 */
function runAssessmentEngine(evidenceScores, evidenceConfig) {
  let finalScore = 0;
  const breakdown = [];
  const belowReq  = [];

  for (const cfg of evidenceConfig) {
    const entry   = evidenceScores.find((s) => s.evidenceTypeId === cfg.evidenceTypeId);
    const score   = Math.min(100, Math.max(0, entry ? Number(entry.score) : 0));
    const weighted = Math.round((score * cfg.contribution) / 100 * 10) / 10;
    const minReq  = cfg.minRequirement != null ? cfg.minRequirement : 0;

    finalScore += weighted;

    const row = {
      evidenceTypeId: cfg.evidenceTypeId,
      score,
      contribution: cfg.contribution,
      weighted,
      minRequirement: minReq,
      belowMin: score < minReq,
    };
    breakdown.push(row);
    if (row.belowMin) belowReq.push(row);
  }

  return { finalScore: Math.round(finalScore * 10) / 10, breakdown, belowReq };
}

/**
 * Engine 2 — Competency Engine
 * Distributes weighted evidence scores across mapped competencies and normalizes to 0–100.
 *
 * Normalization: for each competency, divides the learner's raw accumulated score by the
 * maximum possible score (what they'd get if they scored 100 on every evidence that maps
 * to that competency). This ensures every competency score is always 0–100 regardless of
 * how many evidences map to it or what their contribution weights are.
 *
 * Partial mappings (competency weights < 100%) are normalized automatically — the
 * mapped portion is treated as 100% of what this evidence contributes to that competency.
 *
 * @param {Array} assessmentBreakdown  Output from runAssessmentEngine().breakdown
 * @param {Array} evidenceConfig       Assessment type's evidenceWeights array (with competencyMappings)
 * @param {Array} competencies         Full competency objects list
 * @returns {Array<{competencyId, name, score}>}
 */
function runCompetencyEngine(assessmentBreakdown, evidenceConfig, competencies) {
  const raw         = {};
  const maxPossible = {};

  for (const cfg of evidenceConfig) {
    const mappings = cfg.competencyMappings || [];
    if (mappings.length === 0) continue;

    const evResult = assessmentBreakdown.find((b) => b.evidenceTypeId === cfg.evidenceTypeId);
    if (!evResult) continue;

    const totalMappingWeight = mappings.reduce((s, m) => s + m.weight, 0);
    if (totalMappingWeight === 0) continue;

    for (const mapping of mappings) {
      const normWeight = mapping.weight / totalMappingWeight;
      raw[mapping.competencyId]         = (raw[mapping.competencyId]         || 0) + evResult.weighted  * normWeight;
      maxPossible[mapping.competencyId] = (maxPossible[mapping.competencyId] || 0) + cfg.contribution   * normWeight;
    }
  }

  return Object.entries(raw).map(([competencyId, rawScore]) => {
    const comp  = competencies.find((c) => c.id === competencyId);
    const max   = maxPossible[competencyId] || 1;
    const score = Math.min(100, Math.round((rawScore / max) * 100 * 10) / 10);
    return { competencyId, name: comp?.name || "Unknown", score };
  });
}

/**
 * Engine 3 — Progress Arc Engine
 * Maps each competency score to a Progress Level and a Performance Band.
 *
 * Both Level and Band use the same score ranges (they are always in sync).
 * Levels that have no minScore/maxScore fall back to band-only mapping.
 *
 * @param {Array<{competencyId, name, score}>} competencyScores
 * @param {Array} progressLevels   Progress level objects (must have minScore, maxScore)
 * @param {Array} performanceBands Band objects (must have minScore, maxScore)
 * @returns {Array<{competencyId, name, score, level, band}>}
 */
function runProgressArcEngine(competencyScores, progressLevels, performanceBands) {
  const sortedBands  = [...performanceBands].sort((a, b) => a.minScore - b.minScore);
  const sortedLevels = [...progressLevels]
    .filter((l) => l.minScore != null && l.maxScore != null)
    .sort((a, b) => a.minScore - b.minScore);

  return competencyScores.map((cs) => {
    const band  = sortedBands.find((b) => cs.score >= b.minScore && cs.score <= b.maxScore) || null;
    const level = sortedLevels.find((l) => cs.score >= l.minScore && cs.score <= l.maxScore) || null;
    return { ...cs, level, band };
  });
}

module.exports = { runAssessmentEngine, runCompetencyEngine, runProgressArcEngine };
