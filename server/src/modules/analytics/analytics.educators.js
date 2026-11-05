// Reports & Analytics → Educators (admins only — hubs never see per-educator tables): each educator
// teaching at the hubs (or the class) in scope, from their performance profile
// (modules/educator-profiles/educator-profile.stats.js — cached, refreshed nightly): parent rating,
// QA, verified hours, reliability, feedback speed, learners and badges. All-time and rolling figures
// as the profile defines them; the period filter doesn't apply here.

const db = require("../../config/db");
const { getStats, fullName } = require("../educator-profiles/educator-profile.stats");

async function getEducators(scope) {
  if (scope.isHubView) return { hidden: true, educators: [] };
  const classIds = scope.filters.classId ? [scope.filters.classId] : scope.classIds;
  if (!classIds.length && !scope.hubIds.length) return { educators: [] };
  const teaching = classIds.length ? await db("class_course_teacher_links").whereIn("classId", classIds).distinct("teacherId").pluck("teacherId") : [];
  const linked = !scope.filters.classId && scope.hubIds.length ? await db("teacher_hub_links").whereIn("hubId", scope.hubIds).distinct("teacherId").pluck("teacherId") : [];
  const ids = [...new Set([...teaching, ...linked])];
  const teachers = ids.length ? await db("teachers").whereIn("id", ids).whereNot("status", "inactive").select("id", "firstName", "lastName", "status", "profilePublic") : [];
  const educators = [];
  for (const t of teachers) {
    const s = await getStats(t.id);
    educators.push({
      teacherId: t.id,
      name: fullName(t) || "Educator",
      status: t.status,
      published: !!t.profilePublic,
      rating: s.rating.average,
      smoothed: s.rating.smoothed,
      reviews: s.rating.count,
      qa: s.qa.average ?? s.qa.lastThreeAverage,
      qaCount: s.qa.count,
      hours: s.hours.total,
      hours90: s.hours.last90Days,
      sessions: s.sessions.total,
      learners: s.learnersTaught,
      reliability: s.reliability.rate,
      planned: s.reliability.planned,
      feedbackHours: s.feedback.medianHours,
      finished: s.outcomes.learnersFinished,
      averageScore: s.outcomes.averageScore,
      badges: s.badges.filter((b) => b.earned).map((b) => b.label),
    });
  }
  const avg = (xs) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null);
  return {
    educators,
    totals: {
      educators: educators.length,
      hours90: Math.round(educators.reduce((n, e) => n + (e.hours90 || 0), 0)),
      rating: avg(educators.filter((e) => e.rating != null).map((e) => e.rating)),
      qa: avg(educators.filter((e) => e.qa != null).map((e) => e.qa)),
      published: educators.filter((e) => e.published).length,
    },
  };
}

module.exports = { getEducators };
