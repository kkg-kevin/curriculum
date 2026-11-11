// Attendance (10 Nov 2026) — how often learners in scope came, from the class registers
// (attendance: present / late / absent / excused, one row per learner per class day). Excused
// days are left out of every rate. Present and late both count as attended.
//   rate          attended ÷ marked, this period and the one before
//   byDay         each register day's rate (the trend)
//   byWeekday     Monday … Sunday
//   byClass       each class: rate, days registered, learners
//   absences      learners absent 3 or more times, worst first, with their last absence

const db = require("../../config/db");
const { pct, inChunks, fullName, daysOf } = require("./analytics.utils");
const { className } = require("./analytics.scope");

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const REPEATED = 3;

async function registerRows(scope, from, to) {
  return inChunks([...scope.learnerIds], (ids) => {
    // Only registers of classes at the hubs in scope — a learner also enrolled in another
    // workspace's class never brings that class's register in.
    return db("attendance").whereIn("learnerId", ids).whereBetween("date", [from, to])
      .whereIn("classId", scope.classIds.length ? scope.classIds : ["-"])
      .select("learnerId", "classId", "date", "status");
  });
}

const dayKey = (d) => (d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10));

function rateOf(rows) {
  let attended = 0;
  let total = 0;
  for (const r of rows) {
    if (r.status === "excused") continue;
    total += 1;
    if (r.status === "present" || r.status === "late") attended += 1;
  }
  return { attended, total, rate: pct(attended, total) };
}

async function getAttendance(scope) {
  const { period } = scope;
  const rows = await registerRows(scope, period.from, period.to);
  const prev = await registerRows(scope, period.prevFrom, period.prevTo);
  const now = rateOf(rows);
  const before = rateOf(prev);

  const byDate = new Map();
  for (const r of rows) {
    const k = dayKey(r.date);
    if (!byDate.has(k)) byDate.set(k, []);
    byDate.get(k).push(r);
  }
  const byDay = daysOf(period).filter((d) => byDate.has(d)).map((d) => ({ date: d, ...rateOf(byDate.get(d)) }));

  const weekday = WEEKDAYS.map((label) => ({ label, rows: [] }));
  for (const r of rows) weekday[new Date(`${dayKey(r.date)}T12:00:00Z`).getUTCDay()].rows.push(r);
  const byWeekday = [1, 2, 3, 4, 5, 6, 0].map((i) => ({ label: WEEKDAYS[i], ...rateOf(weekday[i].rows) })).filter((w) => w.total > 0);

  const perClass = new Map();
  for (const r of rows) {
    if (!perClass.has(r.classId)) perClass.set(r.classId, []);
    perClass.get(r.classId).push(r);
  }
  const byClass = [...perClass.entries()].map(([classId, list]) => {
    const cls = scope.classById.get(classId);
    return {
      classId,
      label: cls ? className(cls) : "Other class",
      hubName: cls ? scope.hubById.get(cls.schoolId)?.name || "" : "",
      days: new Set(list.map((r) => dayKey(r.date))).size,
      learners: new Set(list.map((r) => r.learnerId)).size,
      ...rateOf(list),
    };
  }).sort((a, b) => (a.rate ?? 101) - (b.rate ?? 101));

  const perLearner = new Map();
  for (const r of rows) {
    const x = perLearner.get(r.learnerId) || { absent: 0, late: 0, total: 0, attended: 0, lastAbsent: null };
    if (r.status === "excused") continue;
    x.total += 1;
    if (r.status === "present" || r.status === "late") x.attended += 1;
    if (r.status === "late") x.late += 1;
    if (r.status === "absent") {
      x.absent += 1;
      const d = dayKey(r.date);
      if (!x.lastAbsent || d > x.lastAbsent) x.lastAbsent = d;
    }
    perLearner.set(r.learnerId, x);
  }
  const firstLink = new Map();
  for (const l of scope.links) if (!firstLink.has(l.learnerId)) firstLink.set(l.learnerId, l);
  const absences = [...perLearner.entries()]
    .filter(([, x]) => x.absent >= REPEATED)
    .map(([learnerId, x]) => {
      const l = scope.learnerById.get(learnerId);
      const link = firstLink.get(learnerId);
      return {
        learnerId, name: fullName(l), absent: x.absent, late: x.late, days: x.total, rate: pct(x.attended, x.total), lastAbsent: x.lastAbsent,
        className: link?.classId ? className(scope.classById.get(link.classId)) : "",
        hubName: scope.hubById.get(link?.hubId)?.name || "",
      };
    })
    .sort((a, b) => b.absent - a.absent || (a.rate ?? 101) - (b.rate ?? 101));

  const statusCounts = { present: 0, late: 0, absent: 0, excused: 0 };
  for (const r of rows) if (statusCounts[r.status] !== undefined) statusCounts[r.status] += 1;

  return {
    period,
    rate: now.rate, attended: now.attended, marked: now.total, previousRate: before.rate,
    registerDays: byDate.size,
    learnersRegistered: perLearner.size,
    statusCounts,
    byDay, byWeekday, byClass,
    repeatedThreshold: REPEATED,
    absences: absences.slice(0, 500),
  };
}

module.exports = { getAttendance, rateOf, registerRows };
