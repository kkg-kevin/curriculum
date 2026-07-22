/**
 * Pure scoring engine functions — no side effects, no DB access.
 * Each engine takes data in and returns computed results.
 * Can be tested independently and reused across service methods.
 */

const { roundTo1Decimal } = require("../../../shared/utils/helpers");

/**
 * Engine 1 — Assessment Engine
 * Computes weighted score per evidence and overall final score.
 *
 * @param {Array<{evidenceTypeId, score}>} evidenceScores  Learner scores per evidence
 * @param {Array}                          evidenceConfig   Assessment type's evidenceWeights array
 * @returns {{ finalScore, breakdown }}
 */
function runAssessmentEngine(evidenceScores, evidenceConfig) {
  let finalScore = 0;
  const breakdown = [];

  for (const cfg of evidenceConfig) {
    const entry   = evidenceScores.find((s) => s.evidenceTypeId === cfg.evidenceTypeId);
    const score   = Math.min(100, Math.max(0, entry ? Number(entry.score) : 0));
    const weighted = Math.round((score * cfg.contribution) / 100 * 10) / 10;

    finalScore += weighted;

    breakdown.push({
      evidenceTypeId: cfg.evidenceTypeId,
      score,
      contribution: cfg.contribution,
      weighted,
    });
  }

  return { finalScore: Math.round(finalScore * 10) / 10, breakdown };
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

/**
 * Engine 4 — Indicator Progress Engine
 * Computes, per Performance Band, how much of that band's 100% a learner has completed —
 * driven entirely by indicator-level achievement, independent of the overall competency score.
 *
 * A band's `indicatorContributions` (set manually in Performance Bands) says how much each
 * indicator is worth toward that band (meant to sum to 100%). This engine takes a learner's
 * achievement per indicator (0-100, e.g. marks earned / marks possible across graded work)
 * and multiplies it against each contribution's weight to get the band's overall completion.
 *
 * @param {Array<{competencyId, indicatorId, percent}>} indicatorAchievements  Learner's 0-100 achievement per indicator
 * @param {Array} performanceBands  Band objects (must have indicatorContributions, advancementThreshold)
 * @returns {Array<{bandId, name, completion, advancementThreshold, thresholdMet}>}
 */
function runIndicatorProgressEngine(indicatorAchievements, performanceBands) {
  return performanceBands.map((band) => {
    const contributions = band.indicatorContributions || [];
    const completion = contributions.reduce((sum, c) => {
      const achievement = indicatorAchievements.find(
        (a) => a.competencyId === c.competencyId && a.indicatorId === c.indicatorId
      );
      const percent = achievement ? Math.min(100, Math.max(0, Number(achievement.percent) || 0)) : 0;
      return sum + (percent * c.percentage) / 100;
    }, 0);
    const rounded = roundTo1Decimal(completion);
    const threshold = band.advancementThreshold ?? 0;
    return {
      bandId: band.id,
      name: band.name,
      completion: rounded,
      advancementThreshold: threshold,
      thresholdMet: rounded >= threshold,
    };
  });
}

/**
 * Engine 5 — Assessment Type Combination Engine
 * Combines each Assessment Type's own competency scores (Engine 2 output, run once per
 * Assessment Type against its own evidenceWeights/competencyMappings) into one overall score
 * per competency — weighted-averaged by each Assessment Type's own typeWeight (tier-2 of Score
 * Evidence). Normalized by the sum of *contributing* weights, not a flat 100, so a competency
 * only covered by some Assessment Types isn't penalized for the ones that don't map to it.
 *
 * @param {Array<{typeWeight, competencyScores: Array<{competencyId, name, score}>}>} perTypeResults
 * @returns {Array<{competencyId, name, score}>}
 */
function combineAssessmentTypeScores(perTypeResults) {
  const weightedSum = {};
  const weightTotal  = {};
  const names        = {};

  for (const { typeWeight, competencyScores } of perTypeResults) {
    for (const cs of competencyScores) {
      weightedSum[cs.competencyId] = (weightedSum[cs.competencyId] || 0) + cs.score * typeWeight;
      weightTotal[cs.competencyId] = (weightTotal[cs.competencyId] || 0) + typeWeight;
      names[cs.competencyId] = cs.name;
    }
  }

  return Object.keys(weightedSum).map((competencyId) => {
    const total = weightTotal[competencyId] || 0;
    const score = total > 0 ? Math.min(100, Math.round((weightedSum[competencyId] / total) * 10) / 10) : 0;
    return { competencyId, name: names[competencyId] || "Unknown", score };
  });
}

module.exports = {
  runAssessmentEngine,
  runCompetencyEngine,
  runProgressArcEngine,
  runIndicatorProgressEngine,
  combineAssessmentTypeScores,
};
