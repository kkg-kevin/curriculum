// Assessments — issuing → handing in → marking → reports, for work issued in the period, plus
// what is waiting right now (marking backlog, overdue work) and how hard each assessment was.

const db = require("../../config/db");
const { pct, round, mean, levelKey, emptyLevels, inChunks, fullName, stripHtml, json } = require("./analytics.utils");
const { loadWork, namesFor } = require("./analytics.work");
const { className } = require("./analytics.scope");

const typeLabel = (t) => String(t || "other").replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

function rate(tasks) {
  const handedIn = tasks.filter((t) => t.handedIn).length;
  const marked = tasks.filter((t) => t.marked);
  return {
    tasks: tasks.length,
    handedIn,
    handedInPercent: pct(handedIn, tasks.length),
    missed: tasks.filter((t) => t.timing === "missed").length,
    marked: marked.length,
    averageScore: round(mean(marked.map((t) => t.percent))),
  };
}

function groupBy(list, keyOf) {
  const m = new Map();
  for (const x of list) { const k = keyOf(x); if (k == null) continue; (m.get(k) || m.set(k, []).get(k)).push(x); }
  return m;
}

async function getAssessments(scope) {
  const { period } = scope;
  const [cur, prev] = await Promise.all([loadWork(scope, period.start, period.end), loadWork(scope, period.prevStart, period.prevEnd)]);
  const tasks = cur.tasks;
  const learnerName = (id) => fullName(scope.learnerById.get(id));
  const classOf = (t) => scope.classById.get(t.issue.classId || t.sub?.classId) || null;

  // ---- Issuing ---------------------------------------------------------------------------------
  const byTypeMap = groupBy(tasks, (t) => cur.assessmentById.get(t.issue.assessmentId)?.type || "other");
  const issuesByType = groupBy(cur.issues, (i) => cur.assessmentById.get(i.assessmentId)?.type || "other");
  const byType = [...new Set([...byTypeMap.keys(), ...issuesByType.keys()])].map((type) => ({
    type, label: typeLabel(type), issues: (issuesByType.get(type) || []).length, ...rate(byTypeMap.get(type) || []),
  })).sort((a, b) => b.issues - a.issues);

  const byCourseMap = groupBy(tasks, (t) => t.issue.courseId || "none");
  const byCourse = [...byCourseMap.entries()].map(([id, list]) => ({
    courseId: id === "none" ? null : id,
    label: id === "none" ? "Not part of a course" : cur.courseById.get(id)?.name || "Course",
    issues: new Set(list.map((t) => t.issue.id)).size,
    ...rate(list),
  })).sort((a, b) => b.tasks - a.tasks);

  const byClassMap = groupBy(tasks, (t) => classOf(t)?.id || null);
  const byClass = [...byClassMap.entries()].map(([id, list]) => {
    const c = scope.classById.get(id);
    return { classId: id, label: className(c), hubName: scope.hubById.get(c?.schoolId)?.name || "", learners: new Set(list.map((t) => t.learnerId)).size, ...rate(list) };
  }).sort((a, b) => (a.handedInPercent ?? 101) - (b.handedInPercent ?? 101));

  let byIssuer = [];
  if (!scope.isHubView) {
    const issuerGroups = groupBy(cur.issues, (i) => i.issuedBy || "system");
    const names = await namesFor([...issuerGroups.keys()]);
    byIssuer = [...issuerGroups.entries()].map(([id, list]) => ({
      key: id,
      label: id === "system" ? "Issued automatically" : names.get(id)?.name || "Someone no longer here",
      teacherId: names.get(id)?.teacherId || null,
      issues: list.length,
      withoutDueDate: list.filter((i) => !i.dueDate).length,
    })).sort((a, b) => b.issues - a.issues);
  }

  // ---- The funnel ------------------------------------------------------------------------------
  const funnel = [
    { key: "issued", label: "Issued to learners", count: tasks.length },
    { key: "started", label: "Started", count: tasks.filter((t) => t.started).length },
    { key: "handedIn", label: "Handed in", count: tasks.filter((t) => t.handedIn).length },
    { key: "marked", label: "Marked", count: tasks.filter((t) => t.marked).length },
    { key: "released", label: "Released to the learner", count: tasks.filter((t) => t.released).length },
  ].map((s) => ({ ...s, percent: pct(s.count, tasks.length) }));

  // ---- Overdue (missed) work from the period, most overdue first -------------------------------
  const nowMs = Date.now();
  const overdue = tasks.filter((t) => t.timing === "missed").map((t) => ({
    learnerId: t.learnerId,
    learner: learnerName(t.learnerId),
    assessment: cur.assessmentById.get(t.issue.assessmentId)?.name || "Assessment",
    className: className(classOf(t)),
    hubName: scope.hubById.get(classOf(t)?.schoolId)?.name || "",
    dueDate: String(t.issue.dueDate).slice(0, 10),
    daysOverdue: Math.floor((nowMs - t.dueEnd.getTime()) / 86400000),
    started: t.started,
  })).sort((a, b) => b.daysOverdue - a.daysOverdue);

  // ---- Waiting to be marked, now (whenever it was issued) ---------------------------------------
  const waiting = (await inChunks([...scope.learnerIds], (ids) => db("assessment_submissions").whereIn("learnerId", ids).where({ status: "submitted" })
    .select("id", "issueId", "assessmentId", "learnerId", "classId", "submittedAt")));
  const waitIssues = await inChunks(waiting.map((w) => w.issueId), (ids) => db("assessment_issues").whereIn("id", ids).select("id", "classId", "courseId"));
  const waitIssueById = new Map(waitIssues.map((i) => [i.id, i]));
  const waitAssessments = await inChunks(waiting.map((w) => w.assessmentId), (ids) => db("assessments").whereIn("id", ids).select("id", "name"));
  const waitName = new Map(waitAssessments.map((a) => [a.id, a.name]));
  const backlog = waiting
    .map((w) => ({ ...w, issue: waitIssueById.get(w.issueId) }))
    .filter((w) => !scope.filters.courseId || w.issue?.courseId === scope.filters.courseId)
    .filter((w) => !scope.narrowedByClass || scope.classById.has(w.issue?.classId || w.classId))
    .map((w) => {
      const c = scope.classById.get(w.issue?.classId || w.classId);
      return {
        learnerId: w.learnerId,
        learner: learnerName(w.learnerId),
        assessment: waitName.get(w.assessmentId) || "Assessment",
        className: className(c),
        hubName: scope.hubById.get(c?.schoolId)?.name || "",
        issueId: w.issueId,
        submittedAt: w.submittedAt,
        daysWaiting: w.submittedAt ? Math.floor((nowMs - new Date(w.submittedAt).getTime()) / 86400000) : null,
      };
    })
    .sort((a, b) => (b.daysWaiting ?? 0) - (a.daysWaiting ?? 0));

  // ---- Reports and certificates ----------------------------------------------------------------
  const reports = await inChunks([...scope.learnerIds], (ids) => {
    const q = db("reports").whereIn("learnerId", ids).whereIn("hubId", scope.hubIds).select("id", "sessionId", "status", "publishedAt", "classId", "courseId");
    if (scope.filters.courseId) q.where({ courseId: scope.filters.courseId });
    return q;
  });
  const inScopeClass = (r) => !scope.narrowedByClass || scope.classById.has(r.classId);
  const inRange = (d, s, e) => d && new Date(d) >= s && new Date(d) <= e;
  const rs = reports.filter(inScopeClass);
  const certificates = await inChunks([...scope.learnerIds], (ids) => {
    const q = db("certificates").whereIn("learnerId", ids).where({ status: "issued" }).whereBetween("issuedAt", [period.start, period.end]).select("id", "kind", "courseId", "classId");
    if (scope.filters.courseId) q.where({ courseId: scope.filters.courseId });
    return q;
  });
  const reportStats = {
    sessionReportsPublished: rs.filter((r) => r.sessionId && r.status === "published" && inRange(r.publishedAt, period.start, period.end)).length,
    courseReportsPublished: rs.filter((r) => !r.sessionId && r.status === "published" && inRange(r.publishedAt, period.start, period.end)).length,
    courseReportsDraft: rs.filter((r) => !r.sessionId && r.status === "draft").length,
    certificatesIssued: certificates.filter((c) => !scope.narrowedByClass || !c.classId || scope.classById.has(c.classId)).length,
  };

  // ---- How each assessment went: score spread, and the questions most learners got wrong --------
  const markedByAssessment = groupBy(tasks.filter((t) => t.marked), (t) => t.issue.assessmentId);
  const scoreSpread = [...markedByAssessment.entries()].map(([id, list]) => {
    const levels = emptyLevels();
    list.forEach((t) => { levels[levelKey(t.percent)] += 1; });
    return { assessmentId: id, name: cur.assessmentById.get(id)?.name || "Assessment", type: typeLabel(cur.assessmentById.get(id)?.type), marked: list.length, averageScore: round(mean(list.map((t) => t.percent))), levels };
  }).sort((a, b) => b.marked - a.marked);

  const itemStats = new Map();
  for (const t of tasks) {
    if (!t.marked) continue;
    for (const r of json(t.sub.autoItemResults) || []) {
      const key = `${t.issue.assessmentId}:${r.itemId}`;
      const s = itemStats.get(key) || { assessmentId: t.issue.assessmentId, itemId: r.itemId, attempts: 0, correct: 0, earned: 0, possible: 0 };
      s.attempts += 1;
      if (r.correct === true || (r.maxMarks > 0 && r.marksAwarded >= r.maxMarks)) s.correct += 1;
      s.earned += Number(r.marksAwarded) || 0;
      s.possible += Number(r.maxMarks) || 0;
      itemStats.set(key, s);
    }
  }
  const hardestQuestions = [...itemStats.values()]
    .filter((s) => s.attempts >= 2)
    .map((s) => {
      const a = cur.assessmentById.get(s.assessmentId);
      const item = (a?.items || []).find((i) => i.id === s.itemId);
      return {
        assessmentId: s.assessmentId,
        assessment: a?.name || "Assessment",
        itemId: s.itemId,
        question: stripHtml(item?.question || item?.prompt || item?.title || "").slice(0, 160) || "Question",
        kind: item?.kind || null,
        attempts: s.attempts,
        correctPercent: pct(s.correct, s.attempts),
        averageMarksPercent: pct(s.earned, s.possible),
      };
    })
    .sort((a, b) => (a.correctPercent ?? 0) - (b.correctPercent ?? 0) || b.attempts - a.attempts)
    .slice(0, 20);

  const prevRate = rate(prev.tasks);
  const curRate = rate(tasks);
  return {
    period,
    headline: {
      issues: cur.issues.length,
      prevIssues: prev.issues.length,
      tasks: tasks.length,
      handedInPercent: curRate.handedInPercent,
      prevHandedInPercent: prevRate.handedInPercent,
      onTimePercent: pct(tasks.filter((t) => t.timing === "on_time").length, tasks.filter((t) => ["on_time", "late", "missed"].includes(t.timing)).length),
      missed: curRate.missed,
      averageScore: curRate.averageScore,
      prevAverageScore: prevRate.averageScore,
      waitingToMark: backlog.length,
      withoutDueDate: cur.issues.filter((i) => !i.dueDate).length,
    },
    funnel,
    byType,
    byCourse,
    byClass,
    byIssuer,
    overdue: overdue.slice(0, 500),
    overdueCount: overdue.length,
    backlog: backlog.slice(0, 500),
    reports: reportStats,
    scoreSpread,
    hardestQuestions,
  };
}

module.exports = { getAssessments };
