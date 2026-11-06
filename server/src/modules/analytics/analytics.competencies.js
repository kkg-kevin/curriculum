// Competencies — how each competency is going for the scope's learners, from the work marked in
// the period (every marked assessment's per-indicator marks, diagnostics included). Each learner
// gets a percentage per indicator and per competency (their marks put together, at most 100%);
// a competency then shows how many learners sit at each of the four level words, its average,
// its indicators, and comparisons by hub or class, gender and stage, plus a month-by-month trend.
// Raw marks — the curriculum's evidence weights aren't applied, so the numbers can differ a
// little from a learner's own profile.

const db = require("../../config/db");
const CompetencyModel = require("../settings/competencies/competency.model");
const { pct, round, mean, levelKey, emptyLevels, inChunks, fullName, json, kenyaDay } = require("./analytics.utils");
const { className } = require("./analytics.scope");
const CountedWork = require("../assessments/submissions/counted-work");

const capped = (earned, possible) => (possible > 0 ? Math.min(100, (earned / possible) * 100) : null);

function spread(percents) {
  const levels = emptyLevels();
  percents.forEach((p) => { levels[levelKey(p)] += 1; });
  return { learners: percents.length, average: round(mean(percents)), levels };
}

async function getCompetencies(scope) {
  const { period } = scope;
  let subs = await inChunks([...scope.learnerIds], (ids) => db("assessment_submissions").whereIn("learnerId", ids)
    .where({ status: "graded" }).whereBetween("gradedAt", [period.start, period.end])
    .select("id", "issueId", "learnerId", "classId", "status", "reportPublished", "indicatorBreakdown", "gradedAt"));
  // Only work that counts: not revoked, issue still standing, a reissued learner's latest attempt.
  subs = (await CountedWork.sortWork(subs)).counted.map((e) => e.submission);
  if (scope.filters.courseId || scope.narrowedByClass) {
    const issues = await inChunks(subs.map((s) => s.issueId), (ids) => db("assessment_issues").whereIn("id", ids).select("id", "courseId", "classId"));
    const issueById = new Map(issues.map((i) => [i.id, i]));
    subs = subs.filter((s) => {
      const i = issueById.get(s.issueId);
      if (scope.filters.courseId && i?.courseId !== scope.filters.courseId) return false;
      const cls = i?.classId || s.classId;
      return !scope.narrowedByClass || !cls || scope.classById.has(cls);
    });
  }

  // indicator id -> its competency and name.
  const comps = await CompetencyModel.findAll();
  const indicatorInfo = new Map();
  for (const c of comps) for (const ind of c.indicators || []) indicatorInfo.set(ind.id, { competencyId: c.id, competencyName: c.name, indicatorName: ind.name });

  // Marks per learner per indicator, and per month per competency.
  const byLearner = new Map(); // learnerId -> Map(indicatorId -> {e,p})
  const monthly = new Map(); // `${month}|${competencyId}` -> {e,p}
  for (const s of subs) {
    const month = kenyaDay(s.gradedAt)?.slice(0, 7);
    for (const r of json(s.indicatorBreakdown) || []) {
      const info = indicatorInfo.get(r.indicatorId);
      if (!info) continue;
      const e = Number(r.marksEarned) || 0;
      const p = Number(r.marksPossible) || 0;
      if (p <= 0) continue;
      const m = byLearner.get(s.learnerId) || byLearner.set(s.learnerId, new Map()).get(s.learnerId);
      const cur = m.get(r.indicatorId) || { e: 0, p: 0 };
      cur.e += e; cur.p += p;
      m.set(r.indicatorId, cur);
      const key = `${month}|${info.competencyId}`;
      const mm = monthly.get(key) || { e: 0, p: 0 };
      mm.e += e; mm.p += p;
      monthly.set(key, mm);
    }
  }

  // Per competency: each learner's percentage, and each indicator's.
  const compLearner = new Map(); // competencyId -> Map(learnerId -> {e,p})
  const indLearner = new Map(); // indicatorId -> Map(learnerId -> percent)
  for (const [learnerId, inds] of byLearner) {
    for (const [indicatorId, { e, p }] of inds) {
      const info = indicatorInfo.get(indicatorId);
      const cm = compLearner.get(info.competencyId) || compLearner.set(info.competencyId, new Map()).get(info.competencyId);
      const cur = cm.get(learnerId) || { e: 0, p: 0 };
      cur.e += e; cur.p += p;
      cm.set(learnerId, cur);
      (indLearner.get(indicatorId) || indLearner.set(indicatorId, new Map()).get(indicatorId)).set(learnerId, capped(e, p));
    }
  }

  // Where each learner sits, for the comparisons.
  const firstLink = new Map();
  for (const l of scope.links) if (!firstLink.has(l.learnerId)) firstLink.set(l.learnerId, l);
  const stageIds = [...new Set(scope.links.map((l) => l.currentStageId).filter(Boolean))];
  const stages = stageIds.length ? await db("age_categories").whereIn("id", stageIds).select("id", "name", "order") : [];
  const stageName = new Map(stages.map((s) => [s.id, s.name]));
  const byClassView = scope.isHubView || scope.hubs.length === 1;
  const groupOf = (learnerId) => {
    const l = firstLink.get(learnerId);
    if (!l) return null;
    return byClassView ? { key: l.classId || "none", label: l.classId ? className(scope.classById.get(l.classId)) : "No class" } : { key: l.hubId, label: scope.hubById.get(l.hubId)?.name || "Hub" };
  };
  const genderLabel = (g) => (g === "male" ? "Boys" : g === "female" ? "Girls" : g ? "Other" : "Not recorded");

  const competencies = [...compLearner.entries()].map(([competencyId, learners]) => {
    const name = comps.find((c) => c.id === competencyId)?.name || "Competency";
    const rows = [...learners.entries()].map(([learnerId, { e, p }]) => ({ learnerId, percent: Math.round(capped(e, p)) }));
    const indicators = [...indLearner.entries()]
      .filter(([indicatorId]) => indicatorInfo.get(indicatorId)?.competencyId === competencyId)
      .map(([indicatorId, m]) => ({ indicatorId, name: indicatorInfo.get(indicatorId).indicatorName, ...spread([...m.values()]) }))
      .sort((a, b) => (a.average ?? 0) - (b.average ?? 0));
    const compare = (keyOf) => {
      const g = new Map();
      for (const r of rows) {
        const k = keyOf(r.learnerId);
        if (!k) continue;
        const cur = g.get(k.key) || { key: k.key, label: k.label, percents: [] };
        cur.percents.push(r.percent);
        g.set(k.key, cur);
      }
      return [...g.values()].map((x) => ({ key: x.key, label: x.label, learners: x.percents.length, average: round(mean(x.percents)) })).sort((a, b) => String(a.label).localeCompare(String(b.label)));
    };
    return {
      competencyId,
      name,
      ...spread(rows.map((r) => r.percent)),
      indicators,
      byGroup: compare(groupOf),
      byGender: compare((id) => ({ key: scope.learnerById.get(id)?.gender || "none", label: genderLabel(scope.learnerById.get(id)?.gender) })),
      byStage: compare((id) => { const s = firstLink.get(id)?.currentStageId; return { key: s || "none", label: s ? stageName.get(s) || "Stage" : "No stage yet" }; }),
      learnerRows: rows.sort((a, b) => a.percent - b.percent).slice(0, 300).map((r) => ({ ...r, name: fullName(scope.learnerById.get(r.learnerId)), level: levelKey(r.percent), group: groupOf(r.learnerId)?.label || "" })),
    };
  }).sort((a, b) => a.name.localeCompare(b.name));

  const months = [...new Set([...monthly.keys()].map((k) => k.split("|")[0]))].sort();
  const trend = competencies.map((c) => ({
    competencyId: c.competencyId,
    name: c.name,
    points: months.map((month) => { const m = monthly.get(`${month}|${c.competencyId}`); return { month, average: m ? round(capped(m.e, m.p)) : null }; }),
  }));

  // Every learner × competency, across the four levels.
  const levels = emptyLevels();
  competencies.forEach((c) => Object.keys(levels).forEach((k) => { levels[k] += c.levels[k]; }));
  return {
    period,
    headline: {
      competencies: competencies.length,
      learnersAssessed: byLearner.size,
      learnerCount: scope.learners.length,
      assessedPercent: pct(byLearner.size, scope.learners.length),
      markedPieces: subs.length,
      average: round(mean(competencies.map((c) => c.average).filter((x) => x != null))),
      strongest: [...competencies].filter((c) => c.learners > 0).sort((a, b) => b.average - a.average)[0]?.name || null,
      weakest: [...competencies].filter((c) => c.learners > 0).sort((a, b) => a.average - b.average)[0]?.name || null,
      levels,
    },
    groupLabel: byClassView ? "Class" : "Hub",
    competencies,
    months,
    trend,
  };
}

module.exports = { getCompetencies };
