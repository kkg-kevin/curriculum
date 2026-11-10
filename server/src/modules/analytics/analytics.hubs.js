// Hubs side by side (10 Nov 2026, admins only — a hub sees only itself): each hub of the workspace
// in scope on the same figures for the period, so the one that needs support stands out.
//   learners      active places at the hub
//   attendance    its classes' registers: present or late ÷ marked
//   onTime        work with a due date issued to its classes: on time ÷ (on time + late + missed)
//   score         marked work that counts, marks put together
//   atRisk        learners flagged on Learners at risk (analytics.risk.js), and their share
//   rating        parents' overall rating of its mentors, last 12 months (mentor_reviews.hubId)
//   educators     educators linked to it

const db = require("../../config/db");
const { pct, inChunks, round } = require("./analytics.utils");
const { loadWork } = require("./analytics.work");
const { registerRows } = require("./analytics.attendance");
const { getAtRisk } = require("./analytics.risk");
const CountedWork = require("../assessments/submissions/counted-work");

async function getHubs(scope) {
  if (scope.isHubView) return { hidden: true, hubs: [] };
  const { period } = scope;
  const hubOfClass = new Map(scope.classes.map((c) => [c.id, c.schoolId]));
  const firstHub = new Map();
  for (const l of scope.links) if (!firstHub.has(l.learnerId)) firstHub.set(l.learnerId, l.hubId);
  const blank = () => ({ learners: new Set(), attended: 0, marked: 0, onTime: 0, timed: 0, e: 0, p: 0, atRisk: 0 });
  const per = new Map(scope.hubs.map((h) => [h.id, blank()]));
  const bump = (hubId) => per.get(hubId);

  for (const l of scope.links) bump(l.hubId)?.learners.add(l.learnerId);

  for (const r of await registerRows(scope, period.from, period.to)) {
    const x = bump(hubOfClass.get(r.classId));
    if (!x || r.status === "excused") continue;
    x.marked += 1;
    if (r.status === "present" || r.status === "late") x.attended += 1;
  }

  const { tasks } = await loadWork(scope, period.start, period.end);
  for (const t of tasks) {
    const x = bump(hubOfClass.get(t.issue.classId) || t.issue.hubId || firstHub.get(t.learnerId));
    if (!x) continue;
    if (t.timing === "on_time") { x.onTime += 1; x.timed += 1; }
    if (t.timing === "late" || t.timing === "missed") x.timed += 1;
  }

  const graded = (await CountedWork.sortWork(await inChunks([...scope.learnerIds], (ids) => db("assessment_submissions").whereIn("learnerId", ids).where({ status: "graded" })
    .whereBetween("gradedAt", [period.start, period.end]).select("id", "issueId", "learnerId", "classId", "status", "reportPublished", "gradedAt", "totalScore", "maxScore"))))
    .counted.map((e) => e.submission);
  for (const s of graded) {
    const x = bump(hubOfClass.get(s.classId) || firstHub.get(s.learnerId));
    if (!x) continue;
    x.e += Number(s.totalScore) || 0;
    x.p += Number(s.maxScore) || 0;
  }

  const risk = await getAtRisk(scope);
  for (const r of risk.learners) {
    const x = bump(r.hubId);
    if (x) x.atRisk += 1;
  }

  const since = new Date(Date.now() - 365 * 86400000);
  const reviews = scope.hubIds.length ? await db("mentor_reviews").whereIn("hubId", scope.hubIds).where("createdAt", ">=", since).select("hubId", "overall") : [];
  const ratings = new Map();
  for (const r of reviews) {
    const x = ratings.get(r.hubId) || { sum: 0, n: 0 };
    x.sum += Number(r.overall) || 0; x.n += 1;
    ratings.set(r.hubId, x);
  }
  const educatorLinks = scope.hubIds.length ? await db("teacher_hub_links").whereIn("hubId", scope.hubIds).select("hubId", "teacherId") : [];
  const educators = new Map();
  for (const l of educatorLinks) educators.set(l.hubId, (educators.get(l.hubId) || new Set()).add(l.teacherId));

  const hubs = scope.hubs.map((h) => {
    const x = per.get(h.id);
    const learners = x.learners.size;
    const r = ratings.get(h.id);
    return {
      hubId: h.id,
      name: h.name,
      status: h.status || "active",
      online: h.deliveryMode === "virtual" || h.deliveryMode === "hybrid",
      learners,
      educators: educators.get(h.id)?.size || 0,
      attendance: pct(x.attended, x.marked), registered: x.marked,
      onTime: pct(x.onTime, x.timed), timed: x.timed,
      score: x.p > 0 ? Math.min(100, Math.round((x.e / x.p) * 100)) : null,
      atRisk: x.atRisk, atRiskPercent: pct(x.atRisk, learners),
      rating: r ? round(r.sum / r.n, 1) : null, reviews: r?.n || 0,
    };
  }).sort((a, b) => b.learners - a.learners);

  return { period, hubs };
}

module.exports = { getHubs };
