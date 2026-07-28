// A competency's overall percent is the sum of its indicators' earned/possible marks across
// every graded assessment (see server's getLearnerIndicatorProgress) — null when the learner
// hasn't attempted anything tagged to any of this competency's indicators yet. Shared by
// CompetenciesTabContent (Competencies tab) and CompetencyProgressGrid (Overview tab) so both
// show the same number for the same competency.
export function competencyPercent(indicators, progressByIndicator) {
  const relevant = (indicators || []).map((ind) => progressByIndicator.get(ind.id)).filter(Boolean);
  if (relevant.length === 0) return null;
  const earned = relevant.reduce((sum, r) => sum + r.marksEarned, 0);
  const possible = relevant.reduce((sum, r) => sum + r.marksPossible, 0);
  return possible > 0 ? Math.round((earned / possible) * 100) : null;
}
