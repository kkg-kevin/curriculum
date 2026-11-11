// Learner growth (10 Nov 2026) — where each learner started against where they are now, in the
// report's four level words.
//   start   their first marked diagnostic (the website one copied onto their record, or one taken
//           in the portal — a stage or pathway diagnostic): its score
//   now     their marked work (not diagnostics) in the 90 days up to the end of the period, marks
//           put together — only work that counts (counted-work.js: not revoked, latest attempt)
// A learner needs both to be counted. Those with a start but no work since are counted apart.

const db = require("../../config/db");
const { inChunks, fullName, levelKey, LEVELS, round, endOfKenyaDay, addDays } = require("./analytics.utils");
const { className } = require("./analytics.scope");
const CountedWork = require("../assessments/submissions/counted-work");

const NOW_WINDOW_DAYS = 90;
const levelIndex = (key) => LEVELS.findIndex((l) => l.key === key);

async function getGrowth(scope) {
  const { period } = scope;
  const learnerIds = [...scope.learnerIds];
  const subs = await inChunks(learnerIds, (ids) => db("assessment_submissions").whereIn("learnerId", ids).where({ status: "graded" })
    .select("id", "issueId", "assessmentId", "learnerId", "status", "reportPublished", "gradedAt", "submittedAt", "totalScore", "maxScore"));
  const issueIds = [...new Set(subs.map((s) => s.issueId).filter(Boolean))];
  const issues = await inChunks(issueIds, (ids) => db("assessment_issues").whereIn("id", ids).select("id", "ageCategoryId", "pathwayId", "publicAttemptId", "classId", "courseId"));
  const issueById = new Map(issues.map((i) => [i.id, i]));
  // Work of another workspace's class (a learner enrolled there too) never counts here.
  const inScope = (s) => {
    const i = issueById.get(s.issueId);
    return !i?.classId || scope.classById.has(i.classId);
  };
  const isDiagnostic = (s) => {
    const i = issueById.get(s.issueId);
    return Boolean(i && (i.ageCategoryId || i.pathwayId || i.publicAttemptId));
  };

  // Start: each learner's earliest marked diagnostic.
  const start = new Map();
  for (const s of subs) {
    if (!inScope(s) || !isDiagnostic(s) || !(Number(s.maxScore) > 0)) continue;
    const at = new Date(s.submittedAt || s.gradedAt).getTime();
    const prev = start.get(s.learnerId);
    if (!prev || at < prev.at) start.set(s.learnerId, { at, percent: Math.min(100, Math.round((Number(s.totalScore) / Number(s.maxScore)) * 100)), when: s.submittedAt || s.gradedAt });
  }

  // Now: counted, non-diagnostic marked work in the window.
  const windowEnd = endOfKenyaDay(period.to);
  const windowStart = endOfKenyaDay(addDays(period.to, -NOW_WINDOW_DAYS));
  const recent = subs.filter((s) => inScope(s) && !isDiagnostic(s) && s.gradedAt && new Date(s.gradedAt) > windowStart && new Date(s.gradedAt) <= windowEnd);
  const counted = (await CountedWork.sortWork(recent)).counted.map((e) => e.submission);
  const nowMarks = new Map();
  for (const s of counted) {
    const m = nowMarks.get(s.learnerId) || { e: 0, p: 0, n: 0 };
    m.e += Number(s.totalScore) || 0; m.p += Number(s.maxScore) || 0; m.n += 1;
    nowMarks.set(s.learnerId, m);
  }

  const firstLink = new Map();
  for (const l of scope.links) if (!firstLink.has(l.learnerId)) firstLink.set(l.learnerId, l);

  const rows = [];
  let startOnly = 0;
  for (const l of scope.learners) {
    const s = start.get(l.id);
    if (!s) continue;
    const m = nowMarks.get(l.id);
    if (!m || !(m.p > 0)) { startOnly += 1; continue; }
    const nowPercent = Math.min(100, Math.round((m.e / m.p) * 100));
    const from = levelKey(s.percent);
    const to = levelKey(nowPercent);
    const link = firstLink.get(l.id);
    rows.push({
      learnerId: l.id,
      name: fullName(l),
      className: link?.classId ? className(scope.classById.get(link.classId)) : "",
      classId: link?.classId || null,
      hubName: scope.hubById.get(link?.hubId)?.name || "",
      startPercent: s.percent, startLevel: from, startedAt: s.when,
      nowPercent, nowLevel: to, pieces: m.n,
      change: nowPercent - s.percent,
      levelsMoved: levelIndex(to) - levelIndex(from),
    });
  }

  // From level × to level: how many learners made each move.
  const matrix = LEVELS.map((f) => ({ from: f.key, to: Object.fromEntries(LEVELS.map((t) => [t.key, 0])) }));
  for (const r of rows) matrix[levelIndex(r.startLevel)].to[r.nowLevel] += 1;

  const byClassMap = new Map();
  for (const r of rows) {
    const key = r.classId || "-";
    const x = byClassMap.get(key) || { label: r.className || "No class", hubName: r.hubName, learners: 0, start: 0, now: 0, up: 0 };
    x.learners += 1; x.start += r.startPercent; x.now += r.nowPercent; if (r.levelsMoved > 0) x.up += 1;
    byClassMap.set(key, x);
  }
  const byClass = [...byClassMap.values()].map((x) => ({
    label: x.label, hubName: x.hubName, learners: x.learners,
    start: round(x.start / x.learners), now: round(x.now / x.learners), change: round((x.now - x.start) / x.learners), up: x.up,
  })).sort((a, b) => b.change - a.change);

  const n = rows.length;
  const avg = (f) => (n ? round(rows.reduce((t, r) => t + f(r), 0) / n) : null);
  return {
    period,
    windowDays: NOW_WINDOW_DAYS,
    learners: n,
    startOnly,
    noStart: scope.learners.length - n - startOnly,
    movedUp: rows.filter((r) => r.levelsMoved > 0).length,
    same: rows.filter((r) => r.levelsMoved === 0).length,
    movedDown: rows.filter((r) => r.levelsMoved < 0).length,
    averageStart: avg((r) => r.startPercent),
    averageNow: avg((r) => r.nowPercent),
    averageChange: avg((r) => r.change),
    levels: LEVELS.map((l) => ({ key: l.key, label: l.label })),
    startLevels: Object.fromEntries(LEVELS.map((l) => [l.key, rows.filter((r) => r.startLevel === l.key).length])),
    nowLevels: Object.fromEntries(LEVELS.map((l) => [l.key, rows.filter((r) => r.nowLevel === l.key).length])),
    matrix,
    byClass,
    rows: rows.sort((a, b) => b.change - a.change).slice(0, 1000),
  };
}

module.exports = { getGrowth };
