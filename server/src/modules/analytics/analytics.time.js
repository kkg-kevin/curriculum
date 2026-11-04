// Time to task — how fast work moves, for everything issued in the period: issued → started →
// handed in, against the due date, then marking and release. Times are hours between the stored
// dates (wall-clock, not time actively spent on the page). Marking time counts only work an
// educator marked by hand; auto-marked work is marked the moment it's handed in.

const { median, mean, round, pct, bucketDurations } = require("./analytics.utils");
const { loadWork, namesFor } = require("./analytics.work");
const { className } = require("./analytics.scope");

function stage(tasks, key) {
  const hours = tasks.map((t) => t[key]).filter((h) => Number.isFinite(h) && h >= 0);
  return { count: hours.length, medianHours: round(median(hours), 1), averageHours: round(mean(hours), 1), buckets: bucketDurations(hours) };
}

function timing(tasks) {
  const c = { on_time: 0, late: 0, missed: 0, pending: 0, no_due: 0 };
  tasks.forEach((t) => { c[t.timing] += 1; });
  const decided = c.on_time + c.late + c.missed;
  return { ...c, total: tasks.length, onTimePercent: pct(c.on_time, decided), latePercent: pct(c.late, decided), missedPercent: pct(c.missed, decided) };
}

function summary(tasks) {
  return {
    tasks: tasks.length,
    issuedToStart: stage(tasks, "toStart"),
    startToHandIn: stage(tasks, "toHandIn"),
    issuedToHandIn: stage(tasks, "issuedToHandIn"),
    handInToMarked: stage(tasks, "toMark"),
    markedToReleased: stage(tasks, "toRelease"),
    timing: timing(tasks),
  };
}

function groupRows(tasks, keyOf, labelOf) {
  const groups = new Map();
  for (const t of tasks) {
    const k = keyOf(t);
    if (!k) continue;
    (groups.get(k) || groups.set(k, []).get(k)).push(t);
  }
  return [...groups.entries()].map(([key, list]) => {
    const s = summary(list);
    return {
      key,
      label: labelOf(key, list),
      tasks: list.length,
      handedInPercent: pct(list.filter((t) => t.handedIn).length, list.length),
      onTimePercent: s.timing.onTimePercent,
      missed: s.timing.missed,
      medianIssuedToHandInHours: s.issuedToHandIn.medianHours,
      medianMarkingHours: s.handInToMarked.medianHours,
    };
  }).sort((a, b) => b.tasks - a.tasks);
}

async function getTimeToTask(scope) {
  const { period } = scope;
  const [cur, prev] = await Promise.all([loadWork(scope, period.start, period.end), loadWork(scope, period.prevStart, period.prevEnd)]);
  const now = summary(cur.tasks);
  const before = summary(prev.tasks);

  const byCourse = groupRows(cur.tasks, (t) => t.issue.courseId || "none", (k) => (k === "none" ? "Not part of a course" : cur.courseById.get(k)?.name || "Course"));
  const byType = groupRows(cur.tasks, (t) => cur.assessmentById.get(t.issue.assessmentId)?.type || "other", (k) => k.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase()));
  const byGroup = scope.isHubView || scope.hubs.length === 1
    ? groupRows(cur.tasks, (t) => t.issue.classId || t.sub?.classId || null, (k) => className(scope.classById.get(k)))
    : groupRows(cur.tasks, (t) => scope.classById.get(t.issue.classId || t.sub?.classId)?.schoolId || null, (k) => scope.hubById.get(k)?.name || "Hub");

  // Marking speed per educator — the workspace's view only (hubs see the totals).
  let byMarker = [];
  if (!scope.isHubView) {
    const marked = cur.tasks.filter((t) => Number.isFinite(t.toMark) && t.sub?.gradedBy);
    const names = await namesFor(marked.map((t) => t.sub.gradedBy));
    byMarker = groupRows(marked, (t) => t.sub.gradedBy, (k) => names.get(k)?.name || "Someone no longer here")
      .map((r) => ({ ...r, teacherId: names.get(r.key)?.teacherId || null }))
      .sort((a, b) => (a.medianMarkingHours ?? 0) - (b.medianMarkingHours ?? 0));
  }

  // Week by week: how much was handed in, and how much of it on time.
  const weeks = new Map();
  for (const t of cur.tasks) {
    if (!t.handedIn) continue;
    const d = new Date(t.sub?.submittedAt || t.sub?.gradedAt);
    const monday = new Date(d);
    monday.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
    const key = monday.toISOString().slice(0, 10);
    const w = weeks.get(key) || { week: key, handedIn: 0, onTime: 0, late: 0 };
    w.handedIn += 1;
    if (t.timing === "on_time") w.onTime += 1;
    if (t.timing === "late") w.late += 1;
    weeks.set(key, w);
  }

  return {
    period,
    summary: now,
    previous: {
      tasks: before.tasks,
      issuedToHandInMedianHours: before.issuedToHandIn.medianHours,
      handInToMarkedMedianHours: before.handInToMarked.medianHours,
      onTimePercent: before.timing.onTimePercent,
    },
    byCourse,
    byType,
    byGroup,
    groupLabel: scope.isHubView || scope.hubs.length === 1 ? "Class" : "Hub",
    byMarker,
    weekly: [...weeks.values()].sort((a, b) => a.week.localeCompare(b.week)),
  };
}

module.exports = { getTimeToTask };
