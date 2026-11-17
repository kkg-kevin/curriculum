// Parent–mentor check-ins (17 Nov 2026) — Reports & Analytics → People → Parent check-ins.
// From mentor_checkin_meetings (one per family per round; modules/mentor-checkins) of the classes
// in scope, dated in the period:
//   scheduled   every check-in in the period that wasn't cancelled
//   held        its report is written (awaiting the parent, or approved)
//   approved    the parent read and approved the report
//   missed      marked missed; cancelled is counted on its own
// "Waiting now" lists are as of today, whatever the period: reports due (the day has passed, no
// report) and reports waiting on the parent. Timeliness: days from the check-in to its report,
// and from the report to the parent's approval. Families reached: of the learners in the classes
// that had check-ins in the period, those with a held one.
// A hub login sees counts only — never scores or per-educator figures (it never sees reports).

const db = require("../../config/db");
const { pct, median, round, inChunks, fullName, addDays, kenyaDay } = require("./analytics.utils");
const { className } = require("./analytics.scope");
const R = require("../mentor-checkins/mentor-checkin.rules");

const LATE_REPORT_DAYS = 3;
const json = (v) => {
  if (v == null || typeof v !== "string") return v;
  try { return JSON.parse(v); } catch { return null; }
};
const day = (v) => (v instanceof Date ? v.toISOString().slice(0, 10) : String(v || "").slice(0, 10));
const daysBetween = (a, b) => (a && b ? (new Date(b) - new Date(`${day(a)}T00:00:00+03:00`)) / 86400000 : null);
const weekOf = (d) => {
  const dt = new Date(`${d}T12:00:00Z`);
  dt.setUTCDate(dt.getUTCDate() - ((dt.getUTCDay() + 6) % 7));
  return dt.toISOString().slice(0, 10);
};

function tally(rows, today) {
  const t = { scheduled: 0, held: 0, approved: 0, awaitingApproval: 0, reportDue: 0, missed: 0, cancelled: 0, upcoming: 0, confirmed: 0, rescheduled: 0 };
  for (const m of rows) {
    const state = R.meetingState(m, today);
    if (state === "cancelled") { t.cancelled += 1; continue; }
    t.scheduled += 1;
    if (m.confirmedAt) t.confirmed += 1;
    if (m.parentChangedAt) t.rescheduled += 1;
    if (state === "approved") { t.held += 1; t.approved += 1; }
    else if (state === "awaiting_approval") { t.held += 1; t.awaitingApproval += 1; }
    else if (state === "missed") t.missed += 1;
    else if (state === "report_due") t.reportDue += 1;
    else t.upcoming += 1;
  }
  const happened = t.held + t.missed + t.reportDue;
  return { ...t, heldRate: pct(t.held, happened), approvalRate: pct(t.approved, t.held), confirmRate: pct(t.confirmed, t.scheduled) };
}

async function getMentorCheckins(scope) {
  const { period } = scope;
  const today = kenyaDay(new Date());
  const hubView = scope.isHubView;
  const classSet = new Set(scope.classIds);
  const inScope = (m) => classSet.has(m.classId) && (!scope.learnerFiltersOnly || (json(m.learnerIds) || []).some((id) => scope.learnerIds.has(id)));

  // Every check-in of these classes (all time — the period is applied below; the waiting lists are as of today).
  const all = (await inChunks(scope.classIds, (ids) => db("mentor_checkin_meetings").whereIn("classId", ids)
    .select("id", "roundId", "hubId", "classId", "learnerIds", "parentUserId", "date", "startTime", "endTime", "status",
      "confirmedAt", "parentChangedAt", "reportSubmittedAt", "reportSubmittedBy", "approvedAt", "score")))
    .map((m) => ({ ...m, date: day(m.date), learnerIds: json(m.learnerIds) || [] }))
    .filter(inScope);
  const inPeriod = all.filter((m) => m.date >= period.from && m.date <= period.to);
  const prevPeriod = all.filter((m) => m.date >= period.prevFrom && m.date <= period.prevTo);

  const roundIds = [...new Set(all.map((m) => m.roundId))];
  const rounds = await inChunks(roundIds, (ids) => db("mentor_checkin_rounds").whereIn("id", ids).select("id", "educatorIds", "templateId", "status", "format"));
  const roundById = new Map(rounds.map((r) => [r.id, { ...r, educatorIds: json(r.educatorIds) || [] }]));
  const parentIds = [...new Set(all.map((m) => m.parentUserId).filter(Boolean))];
  const learnerIds = [...new Set(all.flatMap((m) => m.learnerIds))];
  const educatorIds = [...new Set(rounds.flatMap((r) => json(r.educatorIds) || []))];
  const [parents, learners, educators] = await Promise.all([
    inChunks(parentIds, (ids) => db("users").whereIn("id", ids).select("id", "name")),
    inChunks(learnerIds, (ids) => db("learners").whereIn("id", ids).select("id", "firstName", "lastName")),
    inChunks(educatorIds, (ids) => db("teachers").whereIn("id", ids).select("id", "firstName", "lastName")),
  ]);
  const parentName = new Map(parents.map((p) => [p.id, p.name]));
  const learnerName = new Map(learners.map((l) => [l.id, fullName(l)]));
  const educatorName = new Map(educators.map((e) => [e.id, fullName(e)]));

  const now = tally(inPeriod, today);
  const before = tally(prevPeriod, today);

  // Timeliness and scores (held check-ins in the period).
  const held = inPeriod.filter((m) => m.reportSubmittedAt && m.status !== "cancelled");
  const reportDays = held.map((m) => daysBetween(m.date, m.reportSubmittedAt)).filter((d) => d != null).map((d) => Math.max(0, d));
  const approvalDays = held.filter((m) => m.approvedAt).map((m) => (new Date(m.approvedAt) - new Date(m.reportSubmittedAt)) / 86400000).filter((d) => d >= 0);
  const scores = held.map((m) => Number(m.score)).filter((s) => Number.isFinite(s));

  // Families reached: of the learners in the classes that had check-ins in the period, those with a
  // held one (a class with no check-ins set up isn't counted against it).
  const reached = new Set(held.flatMap((m) => m.learnerIds));
  const checkinClasses = new Set(inPeriod.filter((m) => m.status !== "cancelled").map((m) => m.classId));
  const learnersInClasses = new Set(scope.links.filter((l) => checkinClasses.has(l.classId)).map((l) => l.learnerId));
  const reachedInClasses = [...reached].filter((id) => learnersInClasses.has(id)).length;

  // By week (the trend).
  const weeks = new Map();
  for (const m of inPeriod) {
    if (m.status === "cancelled") continue;
    const w = weekOf(m.date);
    const x = weeks.get(w) || { week: w, scheduled: 0, held: 0, missed: 0 };
    x.scheduled += 1;
    if (m.reportSubmittedAt) x.held += 1;
    if (m.status === "missed") x.missed += 1;
    weeks.set(w, x);
  }
  const byWeek = [...weeks.values()].sort((a, b) => a.week.localeCompare(b.week));

  // By hub and by class.
  const group = (keyOf, labelOf) => {
    const map = new Map();
    for (const m of inPeriod) {
      const k = keyOf(m);
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(m);
    }
    return [...map.entries()].map(([k, rows]) => {
      const t = tally(rows, today);
      const s = rows.filter((m) => m.reportSubmittedAt).map((m) => Number(m.score)).filter(Number.isFinite);
      return { key: k, label: labelOf(k), ...t, ...(hubView ? {} : { avgScore: round(s.length ? s.reduce((a, b) => a + b, 0) / s.length : null, 1) }) };
    }).sort((a, b) => b.scheduled - a.scheduled);
  };
  const byHub = group((m) => m.hubId, (id) => scope.hubById.get(id)?.name || "A hub");
  const byClass = group((m) => m.classId, (id) => {
    const cls = scope.classById.get(id);
    return [className(cls), !hubView ? scope.hubById.get(cls?.schoolId)?.name : null].filter(Boolean).join(" · ");
  });

  // By educator (every educator of a check-in's round attends) — admins only.
  let byEducator = [];
  if (!hubView) {
    const per = new Map();
    for (const m of inPeriod) {
      for (const id of roundById.get(m.roundId)?.educatorIds || []) {
        if (!per.has(id)) per.set(id, []);
        per.get(id).push(m);
      }
    }
    byEducator = [...per.entries()].map(([id, rows]) => {
      const t = tally(rows, today);
      const late = rows.filter((m) => m.reportSubmittedAt && daysBetween(m.date, m.reportSubmittedAt) > LATE_REPORT_DAYS).length;
      const s = rows.filter((m) => m.reportSubmittedAt).map((m) => Number(m.score)).filter(Number.isFinite);
      return { key: id, teacherId: id, name: educatorName.get(id) || "Educator", ...t, lateReports: late, avgScore: round(s.length ? s.reduce((a, b) => a + b, 0) / s.length : null, 1) };
    }).sort((a, b) => b.reportDue - a.reportDue || b.scheduled - a.scheduled);
  }

  // Waiting now (as of today, any date).
  const describe = (m) => {
    const cls = scope.classById.get(m.classId);
    return {
      key: m.id, meetingId: m.id, date: m.date, time: `${m.startTime}–${m.endTime}`,
      learners: m.learnerIds.map((id) => learnerName.get(id) || "Learner").join(", "),
      parent: parentName.get(m.parentUserId) || "Parent",
      className: className(cls), hubName: scope.hubById.get(m.hubId)?.name || "",
      educators: (roundById.get(m.roundId)?.educatorIds || []).map((id) => educatorName.get(id)).filter(Boolean).join(", "),
    };
  };
  const reportsDue = all.filter((m) => R.meetingState(m, today) === "report_due")
    .map((m) => ({ ...describe(m), daysOverdue: Math.max(0, Math.round(daysBetween(m.date, new Date()) || 0)) }))
    .sort((a, b) => b.daysOverdue - a.daysOverdue);
  const waitingOnParents = all.filter((m) => R.meetingState(m, today) === "awaiting_approval")
    .map((m) => ({ ...describe(m), daysWaiting: Math.max(0, Math.round((Date.now() - new Date(m.reportSubmittedAt)) / 86400000)) }))
    .sort((a, b) => b.daysWaiting - a.daysWaiting);
  const nextWeek = addDays(today, 7);
  const comingUp = all.filter((m) => m.status === "scheduled" && !m.reportSubmittedAt && m.date >= today && m.date <= nextWeek);

  return {
    period, today, hubView, lateReportDays: LATE_REPORT_DAYS,
    ...now,
    previous: { scheduled: before.scheduled, held: before.held, heldRate: before.heldRate, approvalRate: before.approvalRate },
    medianDaysToReport: round(median(reportDays), 1),
    medianDaysToApproval: round(median(approvalDays), 1),
    lateReports: reportDays.filter((d) => d > LATE_REPORT_DAYS).length,
    ...(hubView ? {} : { avgScore: round(scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null, 1), scored: scores.length }),
    familiesReached: reachedInClasses, learnersInClasses: learnersInClasses.size, reachRate: pct(reachedInClasses, learnersInClasses.size),
    nextSevenDays: { total: comingUp.length, unconfirmed: comingUp.filter((m) => !m.confirmedAt).length },
    waitingNow: { reportsDue: reportsDue.length, waitingOnParents: waitingOnParents.length },
    byWeek, byHub, byClass, byEducator,
    reportsDue: reportsDue.slice(0, 300),
    waitingOnParents: waitingOnParents.slice(0, 300),
  };
}

module.exports = { getMentorCheckins };
