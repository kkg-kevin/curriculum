// Parent engagement (10 Nov 2026) — how involved the families of learners in scope are:
//   reports     reports published in the period, and how many a parent opened (report_views,
//               recorded since 10 Nov 2026 — reports before that show as not opened), and how
//               long they took to open one
//   sign-ins    families with a parent login, and how many signed in during the period
//   check-ins   parent–mentor check-ins in the period: confirmed, held (report written), approved
//   feedback    reviews of mentors given in the period
//   unread      learners whose parent has opened none of their reports published in the period

const db = require("../../config/db");
const { pct, inChunks, fullName, median, hoursBetween, json } = require("./analytics.utils");
const { className } = require("./analytics.scope");

async function getParents(scope) {
  const { period } = scope;
  const learnerIds = [...scope.learnerIds];

  const reports = await inChunks(learnerIds, (ids) => db("reports").whereIn("learnerId", ids).where({ status: "published" })
    .whereIn("classId", scope.classIds.length ? scope.classIds : ["-"])
    .whereBetween("publishedAt", [period.start, period.end]).select("id", "learnerId", "classId", "sessionId", "publishedAt"));
  const views = await inChunks(reports.map((r) => r.id), (ids) => db("report_views").whereIn("reportId", ids).select("reportId", "learnerId", "viewer", "firstViewedAt", "views"));
  const parentViews = new Map();
  const learnerViews = new Set();
  for (const v of views) {
    if (v.viewer === "parent") {
      const prev = parentViews.get(v.reportId);
      if (!prev || new Date(v.firstViewedAt) < new Date(prev.firstViewedAt)) parentViews.set(v.reportId, v);
    } else learnerViews.add(v.reportId);
  }
  const openedByParent = reports.filter((r) => parentViews.has(r.id));
  const hoursToOpen = openedByParent.map((r) => hoursBetween(r.publishedAt, parentViews.get(r.id).firstViewedAt)).filter((h) => h != null && h >= 0);

  // Families: the learners' guardian emails that have a login.
  const emails = [...new Set(scope.learners.map((l) => String(l.guardianEmail || "").toLowerCase()).filter(Boolean))];
  const parentUsers = await inChunks(emails, (e) => db("users").whereIn(db.raw("LOWER(email)"), e).whereNull("deactivatedAt").select("id", "email", "role", "extraRoles"));
  const parentByEmail = new Map(parentUsers.map((u) => [String(u.email).toLowerCase(), u]));
  const signedIn = new Set((await inChunks(parentUsers.map((u) => u.id), (ids) => db("audit_log").whereIn("actorUserId", ids).where({ action: "login" })
    .whereBetween("createdAt", [period.start, period.end]).distinct("actorUserId"))).map((r) => r.actorUserId));

  // Parent–mentor check-ins in the period, at hubs in scope, for learners in scope.
  const meetings = scope.hubIds.length ? (await db("mentor_checkin_meetings").whereIn("hubId", scope.hubIds).whereBetween("date", [period.from, period.to])
    .select("id", "classId", "learnerIds", "status", "confirmedAt", "reportSubmittedAt", "approvedAt"))
    .filter((m) => (json(m.learnerIds) || []).some((id) => scope.learnerIds.has(id))) : [];
  const live = meetings.filter((m) => m.status !== "cancelled");
  const checkins = {
    scheduled: live.length,
    confirmed: live.filter((m) => m.confirmedAt).length,
    held: live.filter((m) => m.reportSubmittedAt).length,
    approved: live.filter((m) => m.approvedAt).length,
    missed: live.filter((m) => m.status === "missed").length,
  };

  const reviews = await inChunks(learnerIds, (ids) => db("mentor_reviews").whereIn("learnerId", ids).whereBetween("createdAt", [period.start, period.end]).select("reviewerUserId", "overall"));

  // Per class: reports published, opened by a parent.
  const byClassMap = new Map();
  for (const r of reports) {
    const x = byClassMap.get(r.classId) || { published: 0, opened: 0 };
    x.published += 1;
    if (parentViews.has(r.id)) x.opened += 1;
    byClassMap.set(r.classId, x);
  }
  const byClass = [...byClassMap.entries()].map(([classId, x]) => {
    const cls = scope.classById.get(classId);
    return { classId, label: cls ? className(cls) : "Other class", hubName: cls ? scope.hubById.get(cls.schoolId)?.name || "" : "", ...x, rate: pct(x.opened, x.published) };
  }).sort((a, b) => (a.rate ?? 101) - (b.rate ?? 101));

  // Learners with reports out but none opened by a parent.
  const byLearner = new Map();
  for (const r of reports) {
    const x = byLearner.get(r.learnerId) || { published: 0, opened: 0, last: null };
    x.published += 1;
    if (parentViews.has(r.id)) x.opened += 1;
    if (!x.last || new Date(r.publishedAt) > new Date(x.last)) x.last = r.publishedAt;
    byLearner.set(r.learnerId, x);
  }
  const firstLink = new Map();
  for (const l of scope.links) if (!firstLink.has(l.learnerId)) firstLink.set(l.learnerId, l);
  const unread = [...byLearner.entries()].filter(([, x]) => x.opened === 0).map(([learnerId, x]) => {
    const l = scope.learnerById.get(learnerId);
    const link = firstLink.get(learnerId);
    const parent = l?.guardianEmail ? parentByEmail.get(String(l.guardianEmail).toLowerCase()) : null;
    return {
      learnerId, name: fullName(l), parentName: l?.guardianName || "", hasLogin: Boolean(parent),
      parentSignedIn: parent ? signedIn.has(parent.id) : false,
      reports: x.published, lastPublished: x.last,
      className: link?.classId ? className(scope.classById.get(link.classId)) : "",
    };
  }).sort((a, b) => b.reports - a.reports);

  const familiesWithLearners = new Set(scope.learners.map((l) => String(l.guardianEmail || "").toLowerCase()).filter(Boolean));
  return {
    period,
    reports: {
      published: reports.length,
      openedByParent: openedByParent.length,
      openedByLearner: learnerViews.size,
      rate: pct(openedByParent.length, reports.length),
      medianHoursToOpen: median(hoursToOpen),
    },
    families: familiesWithLearners.size,
    familiesWithLogin: parentUsers.length,
    parentsSignedIn: signedIn.size,
    signInRate: pct(signedIn.size, parentUsers.length),
    checkins,
    reviews: { count: reviews.length, parents: new Set(reviews.map((r) => r.reviewerUserId)).size },
    byClass,
    unread: unread.slice(0, 500),
  };
}

module.exports = { getParents };
