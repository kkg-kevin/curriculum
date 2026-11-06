// Learners at risk — one list of who needs help now, each with the reasons:
//   low scores        marked work in the period averages under 40% (marks put together)
//   low attendance    under 75% attended (present or late) of at least 3 marked days
//   missed work       2 or more pieces past their due date and never handed in
//   not signing in    has a login (their own or a parent's) but neither signed in for 14 days
// Staff open the learner's page from each row.

const db = require("../../config/db");
const { pct, inChunks, fullName } = require("./analytics.utils");
const { loadWork } = require("./analytics.work");
const { className } = require("./analytics.scope");
const CountedWork = require("../assessments/submissions/counted-work");

const FLAGS = {
  lowScore: { label: "Low scores", threshold: 40 },
  lowAttendance: { label: "Low attendance", threshold: 75, minDays: 3 },
  missedWork: { label: "Missed work", threshold: 2 },
  notSignedIn: { label: "Not signing in", days: 14 },
};

async function getAtRisk(scope) {
  const { period } = scope;
  const learnerIds = [...scope.learnerIds];

  // Only work that counts (counted-work.js): not revoked, issue still standing, latest attempt.
  const graded = (await CountedWork.sortWork(await inChunks(learnerIds, (ids) => db("assessment_submissions").whereIn("learnerId", ids).where({ status: "graded" })
    .whereBetween("gradedAt", [period.start, period.end]).select("id", "issueId", "learnerId", "status", "reportPublished", "gradedAt", "totalScore", "maxScore"))))
    .counted.map((e) => e.submission);
  const marks = new Map();
  for (const s of graded) {
    const m = marks.get(s.learnerId) || { e: 0, p: 0, n: 0 };
    m.e += Number(s.totalScore) || 0; m.p += Number(s.maxScore) || 0; m.n += 1;
    marks.set(s.learnerId, m);
  }

  const attendance = await inChunks(learnerIds, (ids) => {
    const q = db("attendance").whereIn("learnerId", ids).whereBetween("date", [period.from, period.to]).select("learnerId", "status", "classId");
    if (scope.narrowedByClass) q.whereIn("classId", scope.classIds.length ? scope.classIds : ["-"]);
    return q;
  });
  const att = new Map();
  for (const a of attendance) {
    if (a.status === "excused") continue;
    const x = att.get(a.learnerId) || { attended: 0, total: 0 };
    x.total += 1;
    if (a.status === "present" || a.status === "late") x.attended += 1;
    att.set(a.learnerId, x);
  }

  const { tasks } = await loadWork(scope, period.start, period.end);
  const missed = new Map();
  for (const t of tasks) if (t.timing === "missed") missed.set(t.learnerId, (missed.get(t.learnerId) || 0) + 1);

  // Last sign-in: the learner's own login, else their parent's.
  const usernames = scope.learners.map((l) => l.username).filter(Boolean);
  const childUsers = await inChunks(usernames, (u) => db("users").whereIn("username", u).select("id", "username"));
  const emails = [...new Set(scope.learners.map((l) => String(l.guardianEmail || "").toLowerCase()).filter(Boolean))];
  const parentUsers = await inChunks(emails, (e) => db("users").whereIn(db.raw("LOWER(email)"), e).select("id", "email"));
  const last = await inChunks([...childUsers, ...parentUsers].map((u) => u.id), (ids) => db("audit_log").whereIn("actorUserId", ids).where({ action: "login" })
    .groupBy("actorUserId").select("actorUserId").max({ at: "createdAt" }));
  const lastAt = new Map(last.map((r) => [r.actorUserId, r.at]));
  const childByUsername = new Map(childUsers.map((u) => [u.username, u.id]));
  const parentByEmail = new Map(parentUsers.map((u) => [String(u.email).toLowerCase(), u.id]));

  const firstLink = new Map();
  for (const l of scope.links) if (!firstLink.has(l.learnerId)) firstLink.set(l.learnerId, l);
  const cutoff = Date.now() - FLAGS.notSignedIn.days * 86400000;

  const rows = [];
  const counts = Object.fromEntries(Object.keys(FLAGS).map((k) => [k, 0]));
  for (const l of scope.learners) {
    const m = marks.get(l.id);
    const score = m && m.p > 0 ? Math.round((m.e / m.p) * 100) : null;
    const a = att.get(l.id);
    const attendanceRate = a && a.total >= FLAGS.lowAttendance.minDays ? pct(a.attended, a.total) : null;
    const missedCount = missed.get(l.id) || 0;
    const childId = l.username ? childByUsername.get(l.username) : null;
    const parentId = l.guardianEmail ? parentByEmail.get(String(l.guardianEmail).toLowerCase()) : null;
    const hasLogin = Boolean(childId || parentId);
    const lastSignIn = [childId, parentId].map((id) => lastAt.get(id)).filter(Boolean).sort((x, y) => new Date(y) - new Date(x))[0] || null;

    const flags = [];
    if (score != null && score < FLAGS.lowScore.threshold) flags.push("lowScore");
    if (attendanceRate != null && attendanceRate < FLAGS.lowAttendance.threshold) flags.push("lowAttendance");
    if (missedCount >= FLAGS.missedWork.threshold) flags.push("missedWork");
    if (hasLogin && (!lastSignIn || new Date(lastSignIn).getTime() < cutoff)) flags.push("notSignedIn");
    if (!flags.length) continue;
    flags.forEach((f) => { counts[f] += 1; });
    const link = firstLink.get(l.id);
    rows.push({
      learnerId: l.id,
      name: fullName(l),
      hubName: scope.hubById.get(link?.hubId)?.name || "",
      className: link?.classId ? className(scope.classById.get(link.classId)) : "",
      score,
      markedPieces: m?.n || 0,
      attendanceRate,
      attendanceDays: a?.total || 0,
      missed: missedCount,
      lastSignIn,
      hasLogin,
      flags,
    });
  }
  rows.sort((x, y) => y.flags.length - x.flags.length || (x.score ?? 101) - (y.score ?? 101));

  return {
    period,
    flags: Object.entries(FLAGS).map(([key, f]) => ({ key, label: f.label, count: counts[key] })),
    rules: FLAGS,
    learnerCount: scope.learners.length,
    atRiskCount: rows.length,
    atRiskPercent: pct(rows.length, scope.learners.length),
    learners: rows.slice(0, 1000),
  };
}

module.exports = { getAtRisk };
