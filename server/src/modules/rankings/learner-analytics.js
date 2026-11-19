const db = require("../../config/db");
const R = require("./ranking.rules");
const RankingService = require("./ranking.service");
const { loadWork } = require("../analytics/analytics.work");
const { className } = require("../analytics/analytics.scope");
const { inChunks, json, kenyaDay, startOfKenyaDay, endOfKenyaDay, median, round } = require("../analytics/analytics.utils");
const CompetencyModel = require("../settings/competencies/competency.model");
const CountedWork = require("../assessments/submissions/counted-work");

// One learner's analytics — everything they do, for a period: this term (Settings → Rankings'
// period) or this year. For the learner and their parent (`staff: false`: level words, never raw
// marks, nothing about other children beyond their own place) and for staff (`staff: true`:
// percentages too). Sections:
//   overview      Learning Score and place per class, headline figures, badges, streaks
//   assessments   every task with its outcome; by type, by course, month by month
//   attendance    rate, month by month, streak, the latest sessions
//   competencies  each competency's level from the period's marked work
//   engagement    sign-ins (the learner's own login and their parent's), time to start and finish work
//   growth        first diagnostic against the last 90 days, the year month by month
//   projects      projects and their milestones
//   records       published reports and certificates

const TYPE_LABEL = { quiz: "Quizzes", assignment: "Assignments", project: "Projects", observation: "Teacher observations" };
const TIMING_LABEL = { on_time: "Handed in on time", late: "Handed in late", missed: "Missed", pending: "Still open", no_due: "Handed in" };
const levelWord = (p) => R.levelOf(p)?.label || null;
const avg = (xs) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);
const monthOf = (d) => (d ? kenyaDay(new Date(d)).slice(0, 7) : null);

async function learnerAnalytics(learner, { staff = false, period: which = "term" } = {}) {
  const today = kenyaDay(new Date());
  const links = await db("learner_hub_links").where({ learnerId: learner.id, status: "active" });
  const classLinks = links.filter((l) => l.classId);
  const classRows = classLinks.length ? await db("classes").whereIn("id", [...new Set(classLinks.map((l) => l.classId))]) : [];
  const hubIds = [...new Set(links.map((l) => l.hubId).filter(Boolean))];
  const hub = hubIds.length ? await db("learning_hubs").whereIn("id", hubIds).first("ownerAdminId") : null;
  const settings = await RankingService.settingsFor(hub?.ownerAdminId || null);
  const period = which === "year"
    ? { key: `Y-${today.slice(0, 4)}`, label: `This year (${today.slice(0, 4)})`, from: `${today.slice(0, 4)}-01-01`, to: today }
    : R.periodFor(today, settings);
  const to = today < period.to ? today : period.to;
  const start = startOfKenyaDay(period.from);
  const end = endOfKenyaDay(to);
  const pct = (p) => (staff && p != null ? Math.round(p) : undefined);

  // ---- Work ----------------------------------------------------------------------------------
  const scope = {
    classIds: classRows.map((c) => c.id),
    classById: new Map(classRows.map((c) => [c.id, c])),
    links: classLinks,
    learnerIds: new Set([learner.id]),
    filters: { courseId: null },
  };
  const { tasks, assessmentById, courseById } = await loadWork(scope, start, end);
  const mine = tasks.filter((t) => t.learnerId === learner.id);
  const typeOf = (t) => assessmentById.get(t.issue.assessmentId)?.type || "assessment";
  const nameOf = (t) => assessmentById.get(t.issue.assessmentId)?.name || "Assessment";
  const courseOf = (t) => courseById.get(t.issue.courseId)?.name || null;
  const marked = mine.filter((t) => t.marked && t.percent != null);

  const group = (keyOf, labelOf) => {
    const m = new Map();
    for (const t of mine) {
      const k = keyOf(t);
      if (!k) continue;
      const g = m.get(k) || { key: k, label: labelOf(t), count: 0, marked: [] };
      g.count += 1;
      if (t.marked && t.percent != null) g.marked.push(t.percent);
      m.set(k, g);
    }
    return [...m.values()].map((g) => {
      const a = avg(g.marked);
      return { key: g.key, label: g.label, count: g.count, markedCount: g.marked.length, level: levelWord(a), percent: pct(a), value: a == null ? null : Math.round(a) };
    }).sort((x, y) => y.count - x.count);
  };
  const monthly = new Map();
  for (const t of marked) {
    const mo = monthOf(t.sub?.gradedAt);
    if (!mo) continue;
    (monthly.get(mo) || monthly.set(mo, []).get(mo)).push(t.percent);
  }
  const counts = { issued: mine.length, handedIn: mine.filter((t) => t.handedIn).length, onTime: mine.filter((t) => t.timing === "on_time" || t.timing === "no_due").length, late: mine.filter((t) => t.timing === "late").length, missed: mine.filter((t) => t.timing === "missed").length, open: mine.filter((t) => t.timing === "pending").length, marked: marked.length };
  const assessments = {
    counts,
    average: { level: levelWord(avg(marked.map((t) => t.percent))), percent: pct(avg(marked.map((t) => t.percent))) },
    byType: group(typeOf, (t) => TYPE_LABEL[typeOf(t)] || "Other"),
    byCourse: group((t) => t.issue.courseId, (t) => courseOf(t) || "Other"),
    // Bars for families are drawn from `value` (0–100) and labelled by level; staff also see `percent`.
    monthly: [...monthly].sort(([a], [b]) => a.localeCompare(b)).map(([month, list]) => ({ month, value: Math.round(avg(list)), level: levelWord(avg(list)), percent: pct(avg(list)) })),
    list: [...mine].sort((a, b) => new Date(b.issue.issuedAt) - new Date(a.issue.issuedAt)).slice(0, 60).map((t) => ({
      name: nameOf(t), type: TYPE_LABEL[typeOf(t)] || "Assessment", course: courseOf(t), issuedAt: t.issue.issuedAt,
      dueDate: t.issue.dueDate ? String(t.issue.dueDate).slice(0, 10) : null, status: TIMING_LABEL[t.timing] || t.timing, timing: t.timing,
      level: t.marked ? levelWord(t.percent) : null, percent: t.marked ? pct(t.percent) : undefined, issueId: t.issue.id,
    })),
  };

  // ---- Attendance ----------------------------------------------------------------------------
  const att = (await db("attendance").where({ learnerId: learner.id }).whereBetween("date", [period.from, to]).select("classId", "date", "status"))
    .map((a) => ({ ...a, date: String(a.date).slice(0, 10) }));
  const counted = att.filter((a) => a.status !== "excused");
  const came = (a) => a.status === "present" || a.status === "late";
  const byMonth = new Map();
  for (const a of counted) {
    const m = byMonth.get(a.date.slice(0, 7)) || { attended: 0, total: 0 };
    m.total += 1;
    if (came(a)) m.attended += 1;
    byMonth.set(a.date.slice(0, 7), m);
  }
  const classById = scope.classById;
  const streak = R.attendanceStreak(att);
  const attendance = {
    rate: counted.length ? Math.round((counted.filter(came).length / counted.length) * 100) : null,
    sessions: counted.length,
    attended: counted.filter(came).length,
    late: att.filter((a) => a.status === "late").length,
    absent: att.filter((a) => a.status === "absent").length,
    excused: att.filter((a) => a.status === "excused").length,
    streak: streak.current,
    bestStreak: streak.best,
    perfectWeeks: R.perfectWeeks(att).length,
    byMonth: [...byMonth].sort(([a], [b]) => a.localeCompare(b)).map(([month, m]) => ({ month, ...m, rate: Math.round((m.attended / m.total) * 100) })),
    recent: [...att].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 12).map((a) => ({ date: a.date, status: a.status, className: className(classById.get(a.classId)) })),
  };

  // ---- Competencies ------------------------------------------------------------------------
  const subs = (await CountedWork.sortWork(await db("assessment_submissions").where({ learnerId: learner.id, status: "graded" })
    .select("id", "issueId", "assessmentId", "learnerId", "status", "reportPublished", "gradedAt", "submittedAt", "totalScore", "maxScore", "indicatorBreakdown", "milestoneProgress"))).counted.map((e) => e.submission);
  const inPeriod = subs.filter((s) => s.gradedAt && new Date(s.gradedAt) >= start && new Date(s.gradedAt) <= end);
  const comps = await CompetencyModel.findAll();
  const indInfo = new Map();
  for (const c of comps) for (const ind of c.indicators || []) indInfo.set(ind.id, { id: c.id, name: c.name });
  const compMarks = new Map();
  for (const s of inPeriod) {
    for (const r of json(s.indicatorBreakdown) || []) {
      const info = indInfo.get(r.indicatorId);
      const p = Number(r.marksPossible) || 0;
      if (!info || p <= 0) continue;
      const c = compMarks.get(info.id) || { name: info.name, e: 0, p: 0 };
      c.e += Number(r.marksEarned) || 0;
      c.p += p;
      compMarks.set(info.id, c);
    }
  }
  const competencies = [...compMarks.values()].map((c) => {
    const p = Math.min(100, (c.e / c.p) * 100);
    return { name: c.name, level: levelWord(p), percent: pct(p), value: Math.round(p) };
  }).sort((a, b) => b.value - a.value);

  // ---- Engagement --------------------------------------------------------------------------
  const childUser = learner.username ? await db("users").where({ username: learner.username }).first("id") : null;
  const parentUsers = learner.guardianEmail ? await db("users").whereRaw("LOWER(email) = ?", [String(learner.guardianEmail).toLowerCase()]).select("id") : [];
  const loginRows = await inChunks([childUser?.id, ...parentUsers.map((u) => u.id)].filter(Boolean), (ids) => db("audit_log").whereIn("actorUserId", ids).where({ action: "login" })
    .whereBetween("createdAt", [start, end]).select("actorUserId", "createdAt"));
  const weekly = new Map();
  for (const r of loginRows) {
    const w = R.weekStart(kenyaDay(new Date(r.createdAt)));
    const x = weekly.get(w) || { week: w, learner: 0, parent: 0 };
    if (r.actorUserId === childUser?.id) x.learner += 1; else x.parent += 1;
    weekly.set(w, x);
  }
  const lastOf = (ids) => {
    const at = loginRows.filter((r) => ids.includes(r.actorUserId)).map((r) => new Date(r.createdAt).getTime());
    return at.length ? new Date(Math.max(...at)).toISOString() : null;
  };
  const engagement = {
    hasOwnLogin: Boolean(childUser),
    learnerSignIns: childUser ? loginRows.filter((r) => r.actorUserId === childUser.id).length : null,
    parentSignIns: parentUsers.length ? loginRows.filter((r) => r.actorUserId !== childUser?.id).length : null,
    lastLearnerSignIn: childUser ? lastOf([childUser.id]) : null,
    lastParentSignIn: parentUsers.length ? lastOf(parentUsers.map((u) => u.id)) : null,
    weekly: [...weekly.values()].sort((a, b) => a.week.localeCompare(b.week)),
    // Hours from the work being set to starting it, and from starting to handing it in.
    hoursToStart: round(median(mine.map((t) => t.toStart).filter((h) => h != null && h >= 0)), 1),
    hoursToHandIn: round(median(mine.map((t) => t.toHandIn).filter((h) => h != null && h >= 0)), 1),
  };

  // ---- Growth ------------------------------------------------------------------------------
  const issueIds = [...new Set(subs.map((s) => s.issueId).filter(Boolean))];
  const issues = await inChunks(issueIds, (ids) => db("assessment_issues").whereIn("id", ids).select("id", "ageCategoryId", "pathwayId", "publicAttemptId"));
  const diagIds = new Set(issues.filter((i) => i.ageCategoryId || i.pathwayId || i.publicAttemptId).map((i) => i.id));
  const percentOf = (s) => (Number(s.maxScore) > 0 ? Math.min(100, (Number(s.totalScore) / Number(s.maxScore)) * 100) : null);
  const diagnostics = subs.filter((s) => diagIds.has(s.issueId) && percentOf(s) != null).sort((a, b) => new Date(a.submittedAt || a.gradedAt) - new Date(b.submittedAt || b.gradedAt));
  const work = subs.filter((s) => !diagIds.has(s.issueId) && percentOf(s) != null);
  const since90 = Date.now() - 90 * 86400000;
  const nowList = work.filter((s) => new Date(s.gradedAt).getTime() >= since90).map(percentOf);
  const startP = diagnostics.length ? percentOf(diagnostics[0]) : null;
  const nowP = avg(nowList);
  const yearStart = `${today.slice(0, 4)}-01-01`;
  const growthMonthly = new Map();
  for (const s of work) {
    const mo = monthOf(s.gradedAt);
    if (!mo || mo < yearStart.slice(0, 7)) continue;
    (growthMonthly.get(mo) || growthMonthly.set(mo, []).get(mo)).push(percentOf(s));
  }
  const growth = {
    start: startP == null ? null : { level: levelWord(startP), percent: pct(startP), value: Math.round(startP), at: diagnostics[0].submittedAt || diagnostics[0].gradedAt },
    now: nowP == null ? null : { level: levelWord(nowP), percent: pct(nowP), value: Math.round(nowP), pieces: nowList.length },
    change: startP != null && nowP != null ? Math.round(nowP - startP) : null,
    levelsMoved: startP != null && nowP != null ? R.LEVELS.indexOf(R.levelOf(nowP)) - R.LEVELS.indexOf(R.levelOf(startP)) : null,
    monthly: [...growthMonthly].sort(([a], [b]) => a.localeCompare(b)).map(([month, list]) => ({ month, value: Math.round(avg(list)), level: levelWord(avg(list)), percent: pct(avg(list)) })),
  };

  // ---- Projects ----------------------------------------------------------------------------
  const projectTasks = mine.filter((t) => typeOf(t) === "project");
  const projectAssessments = await inChunks([...new Set(projectTasks.map((t) => t.issue.assessmentId))], (ids) => db("assessments").whereIn("id", ids).select("id", "milestones"));
  const milestonesOf = new Map(projectAssessments.map((a) => [a.id, (json(a.milestones) || []).length]));
  const progressOf = async (subId) => {
    if (!subId) return 0;
    const row = await db("assessment_submissions").where({ id: subId }).first("milestoneProgress");
    const mp = json(row?.milestoneProgress);
    if (Array.isArray(mp)) return mp.filter((m) => m && (m.gradedAt || m.marks != null || m.marked)).length;
    return mp && typeof mp === "object" ? Object.keys(mp).length : 0;
  };
  const projects = [];
  for (const t of projectTasks) {
    projects.push({
      name: nameOf(t), course: courseOf(t), status: TIMING_LABEL[t.timing] || t.timing, marked: t.marked, level: t.marked ? levelWord(t.percent) : null, percent: t.marked ? pct(t.percent) : undefined,
      milestones: milestonesOf.get(t.issue.assessmentId) || 0, milestonesMarked: await progressOf(t.sub?.id), issueId: t.issue.id,
    });
  }

  // ---- Reports and certificates ------------------------------------------------------------
  const reports = await db("reports").where({ learnerId: learner.id, status: "published" }).orderBy("publishedAt", "desc").select("id", "courseId", "sessionId", "moduleId", "publishedAt");
  const reportCourses = await inChunks([...new Set(reports.map((r) => r.courseId).filter(Boolean))], (ids) => db("courses").whereIn("id", ids).select("id", "name"));
  const courseName = new Map(reportCourses.map((c) => [c.id, c.name]));
  const certificates = await db("certificates").where({ learnerId: learner.id }).whereNull("revokedAt").orderBy("issuedAt", "desc").select("id", "certificateNumber", "courseId", "issuedAt", "snapshot", "kind");
  const certCourses = await inChunks([...new Set(certificates.map((c) => c.courseId).filter(Boolean))], (ids) => db("courses").whereIn("id", ids).select("id", "name"));
  certCourses.forEach((c) => courseName.set(c.id, c.name));
  const records = {
    reportsInPeriod: reports.filter((r) => r.publishedAt && new Date(r.publishedAt) >= start && new Date(r.publishedAt) <= end).length,
    reportsTotal: reports.length,
    reports: reports.slice(0, 8).map((r) => ({ id: r.id, course: courseName.get(r.courseId) || "Report", kind: r.sessionId ? "Session report" : r.moduleId ? "Module report" : "Course report", publishedAt: r.publishedAt })),
    certificates: certificates.map((c) => ({ id: c.id, number: c.certificateNumber, course: courseName.get(c.courseId) || json(c.snapshot)?.courseName || "Certificate", issuedAt: c.issuedAt })),
  };

  // ---- Positions, badges, streaks ----------------------------------------------------------
  const positions = [];
  for (const c of classRows) {
    try {
      const data = await RankingService.classStanding(c.id);
      const me = data.entries.find((e) => e.learnerId === learner.id);
      if (!me || (!staff && !data.enabled)) continue;
      const standing = data.ranked && me.rank ? R.standingOf(me.rank, data.rankedCount) : null;
      positions.push({
        classId: c.id, className: data.className, period: data.period.label, score: me.score, level: levelWord(me.score), eligible: me.eligible,
        rank: staff ? me.rank : standing?.exact ? me.rank : null, rankedCount: data.ranked ? data.rankedCount : null, band: staff ? null : standing?.band || null, hiddenFromFamily: !data.enabled,
        badges: (data.badges.get(learner.id) || []).map((b) => ({ key: b.key, label: R.BADGES.find((x) => x.key === b.key)?.label || b.key, detail: b.detail })),
        streaks: { onTime: me.streaks.onTime.current, attendance: me.streaks.attendance.current },
      });
    } catch (err) {
      console.error("[learner-analytics] position skipped:", err.message);
    }
  }

  const onTimeShare = counts.handedIn + counts.missed + counts.late ? Math.round((counts.onTime / Math.max(1, counts.onTime + counts.late + counts.missed)) * 100) : null;
  return {
    learner: { id: learner.id, firstName: learner.firstName, lastName: learner.lastName },
    staff,
    period: { ...period, which },
    overview: {
      positions,
      figures: {
        attendance: attendance.rate,
        onTime: onTimeShare,
        marked: counts.marked,
        missed: counts.missed,
        average: assessments.average,
        badges: positions.reduce((n, p) => n + p.badges.length, 0),
        competencies: competencies.length,
        signIns: (engagement.learnerSignIns || 0) + (engagement.parentSignIns || 0),
      },
    },
    assessments,
    attendance,
    competencies,
    engagement,
    growth,
    projects,
    records,
  };
}

module.exports = { learnerAnalytics };
