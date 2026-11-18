const R = require("./ranking.rules");
const RankingService = require("./ranking.service");
const { className } = require("../analytics/analytics.scope");

// Reports & Analytics → Rankings: the classes in the report's view (its hub / class filters), each
// ranked in its current period (ranking.service.js), put side by side — how many are ranked, the
// class average, how scores spread over the four level words, each class's top three and most
// improved — and the top learners and most improved across all of them. Staff see full names.
// Classes with no learners in the view are left out.

async function getRankings(scope) {
  const classes = [];
  const everyone = [];
  let badges = 0;
  for (const cls of scope.classes) {
    const inView = scope.links.some((l) => l.classId === cls.id);
    if (!inView) continue;
    let data;
    try {
      data = await RankingService.classStanding(cls.id);
    } catch (err) {
      console.error("[rankings-report] class skipped:", err.message);
      continue;
    }
    const entries = data.entries.filter((e) => scope.learnerIds.has(e.learnerId));
    if (!entries.length) continue;
    const scored = entries.filter((e) => e.score != null);
    const levels = Object.fromEntries(R.LEVELS.map((l) => [l.key, 0]));
    scored.forEach((e) => { levels[R.levelOf(e.score).key] += 1; });
    const improved = data.boards.find((b) => b.key === "improved");
    const top = improved?.rows.find((r) => r.value > 0 && scope.learnerIds.has(r.learnerId));
    const byId = new Map(entries.map((e) => [e.learnerId, e]));
    const hub = scope.hubById.get(cls.schoolId);
    for (const e of entries) badges += (data.badges.get(e.learnerId) || []).length;
    classes.push({
      classId: cls.id,
      className: className(cls),
      hubName: hub?.name || null,
      period: data.period.label,
      enabled: data.enabled,
      learners: entries.length,
      ranked: data.ranked,
      rankedCount: data.rankedCount,
      averageScore: data.averages.score,
      levels,
      top: entries.filter((e) => e.rank && e.rank <= 3).map((e) => ({ learnerId: e.learnerId, name: e.name, rank: e.rank, score: e.score })),
      mostImproved: top ? { learnerId: top.learnerId, name: byId.get(top.learnerId)?.name, change: R.round1(top.value) } : null,
    });
    for (const e of entries) {
      everyone.push({ learnerId: e.learnerId, name: e.name, className: className(cls), hubName: hub?.name || null, score: e.score, rank: e.rank, rankedCount: data.ranked ? data.rankedCount : null, eligible: e.eligible, growth: e.parts.growthDelta, level: R.levelOf(e.score)?.label || null });
    }
  }
  const eligible = everyone.filter((e) => e.eligible);
  const scores = eligible.map((e) => e.score);
  return {
    stats: {
      classes: classes.length,
      rankedClasses: classes.filter((c) => c.ranked).length,
      learnersScored: everyone.filter((e) => e.score != null).length,
      learnersRanked: eligible.length,
      averageScore: scores.length ? R.round1(scores.reduce((s, v) => s + v, 0) / scores.length) : null,
      badges,
    },
    classes: classes.sort((a, b) => (b.averageScore ?? -1) - (a.averageScore ?? -1)),
    topLearners: [...eligible].sort((a, b) => b.score - a.score).slice(0, 15),
    mostImproved: everyone.filter((e) => e.growth != null && e.growth > 0).sort((a, b) => b.growth - a.growth).slice(0, 15),
  };
}

module.exports = { getRankings };
