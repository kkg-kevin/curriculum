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

// A band with no admin-set bar only ever unlocks at 100% (see scoring-engines.js's
// runIndicatorProgressEngine) — so that's the honest number to quote, not 0/blank.
export function effectiveThreshold(band) {
  return band.advancementThreshold > 0 ? band.advancementThreshold : 100;
}

// One short line: what's left to unlock the next level. Shared by the Progress Arc and the
// Current Level Summary (profile hero, dashboard snapshot), so they always say the same thing.
export function levelCaption(current, next) {
  if (next) {
    const left = Math.max(0, Math.round(effectiveThreshold(next) - next.completion));
    return left > 0 ? `${left}% left to unlock ${next.name}.` : `Almost there — ${next.name} is about to unlock.`;
  }
  if (current) return `You've reached ${current.name}, the top level.`;
  return "Complete graded work to start unlocking levels.";
}

// The level the learner is in, as the Progress Arc shows it: the last one unlocked, or — before
// any is — the one they're working on ("In progress" on the arc).
export function currentLevelName(current, next) {
  return current?.name || next?.name || "Not started";
}
