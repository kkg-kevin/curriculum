// Trends (10 Nov 2026) — the key figures month by month, for the 12 months up to the end of the
// period, so a change shows as a direction and not one snapshot:
//   onTime       of work with a due date issued that month: handed in on time ÷ (on time + late + missed)
//   score        marked work that month (work that counts), marks put together
//   attendance   register days that month: present or late ÷ marked (excused left out)
//   active       learners who handed in at least one piece that month
//   mentors      admins only: of mentors with enough data, the share meeting every mentor standard
//                (the monthly snapshots, mentor-standards)

const db = require("../../config/db");
const { inChunks, pct, kenyaDay, startOfKenyaDay, endOfKenyaDay, json } = require("./analytics.utils");
const { loadWork } = require("./analytics.work");
const { rateOf, registerRows } = require("./analytics.attendance");
const CountedWork = require("../assessments/submissions/counted-work");

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function monthsUpTo(day, count = 12) {
  const [y, m] = day.split("-").map(Number);
  const out = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
    out.push({ key, label: `${MONTH_NAMES[d.getUTCMonth()]} ${String(d.getUTCFullYear()).slice(2)}`, from: `${key}-01`, to: `${key}-${String(last).padStart(2, "0")}` });
  }
  return out;
}
const monthOf = (value) => (value ? String(kenyaDay(value) || "").slice(0, 7) : null);

async function getTrends(scope) {
  const months = monthsUpTo(scope.period.to);
  const start = startOfKenyaDay(months[0].from);
  const end = endOfKenyaDay(months[months.length - 1].to);
  const byMonth = new Map(months.map((m) => [m.key, { ...m, onTime: 0, timed: 0, e: 0, p: 0, active: new Set(), att: [] }]));

  const { tasks } = await loadWork(scope, start, end);
  for (const t of tasks) {
    const row = byMonth.get(monthOf(t.issue.issuedAt));
    if (!row) continue;
    if (t.timing === "on_time") { row.onTime += 1; row.timed += 1; }
    if (t.timing === "late" || t.timing === "missed") row.timed += 1;
  }

  const learnerIds = [...scope.learnerIds];
  const graded = (await CountedWork.sortWork(await inChunks(learnerIds, (ids) => db("assessment_submissions").whereIn("learnerId", ids).where({ status: "graded" })
    .whereBetween("gradedAt", [start, end]).select("id", "issueId", "learnerId", "status", "reportPublished", "gradedAt", "totalScore", "maxScore"))))
    .counted.map((e) => e.submission);
  for (const s of graded) {
    const row = byMonth.get(monthOf(s.gradedAt));
    if (!row) continue;
    row.e += Number(s.totalScore) || 0;
    row.p += Number(s.maxScore) || 0;
  }

  const handedIn = await inChunks(learnerIds, (ids) => db("assessment_submissions").whereIn("learnerId", ids).whereNotNull("submittedAt")
    .whereBetween("submittedAt", [start, end]).select("learnerId", "submittedAt"));
  for (const s of handedIn) byMonth.get(monthOf(s.submittedAt))?.active.add(s.learnerId);

  for (const r of await registerRows(scope, months[0].from, months[months.length - 1].to)) byMonth.get(String(r.date).slice(0, 7))?.att.push(r);

  let mentorByMonth = null;
  if (!scope.isHubView && scope.ownerAdminId) {
    const snaps = await db("mentor_standard_snapshots").where({ ownerAdminId: scope.ownerAdminId }).whereIn("month", months.map((m) => m.key)).select("month", "standing");
    mentorByMonth = new Map();
    for (const s of snaps) {
      const st = json(s.standing) || {};
      if (!(st.counted > 0)) continue;
      const x = mentorByMonth.get(s.month) || { meets: 0, counted: 0 };
      x.counted += 1;
      if (st.overall === "meets") x.meets += 1;
      mentorByMonth.set(s.month, x);
    }
  }

  const series = months.map((m) => {
    const row = byMonth.get(m.key);
    const a = rateOf(row.att);
    const mentors = mentorByMonth?.get(m.key);
    return {
      month: m.key, label: m.label,
      onTime: pct(row.onTime, row.timed), timed: row.timed,
      score: row.p > 0 ? Math.min(100, Math.round((row.e / row.p) * 100)) : null,
      attendance: a.rate, registered: a.total,
      active: row.active.size,
      mentors: mentors ? pct(mentors.meets, mentors.counted) : null,
    };
  });

  // This month against last month, for each figure (null when either has no data).
  const last = series[series.length - 1];
  const prev = series[series.length - 2];
  const change = (k) => (last?.[k] != null && prev?.[k] != null ? last[k] - prev[k] : null);
  return {
    period: scope.period,
    months: series,
    showMentors: Boolean(mentorByMonth),
    latest: { onTime: last?.onTime ?? null, score: last?.score ?? null, attendance: last?.attendance ?? null, active: last?.active ?? 0, mentors: last?.mentors ?? null },
    change: { onTime: change("onTime"), score: change("score"), attendance: change("attendance"), active: change("active"), mentors: change("mentors") },
  };
}

module.exports = { getTrends, monthsUpTo };
