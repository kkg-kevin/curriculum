// Given Engine 4's per-band completion list (useLearnerBandProgress — already ordered by each
// band's own `order` field, ascending), works out which Performance Band this learner currently
// holds and which one to show as "what's next".
//
// `current` is the highest-order band with thresholdMet true — bands aren't necessarily
// nested/cumulative (each band's indicatorContributions are configured independently), so this
// takes the last met entry in the list rather than assuming everything before it was met too.
//
// `next` is deliberately NOT just "the band right after `current` in order": a learner can
// easily be much further into a later band than an earlier one (e.g. 60% into Builder, 0% into
// Explorer, if their graded work happens to map onto Builder's indicators). Showing "0% to
// Explorer" in that case would bury real progress the learner has already made. Instead `next`
// is whichever not-yet-achieved band they're closest to reaching — the most honest and most
// motivating thing to surface as "what's next".
export function deriveBandJourney(bandProgress = []) {
  const achieved = bandProgress.filter((bp) => bp.thresholdMet);
  const current = achieved.length ? achieved[achieved.length - 1] : null;

  const remaining = bandProgress.filter((bp) => !bp.thresholdMet);
  const next = remaining.length
    ? remaining.reduce((best, bp) => (bp.completion > best.completion ? bp : best), remaining[0])
    : null;

  return { current, next };
}
