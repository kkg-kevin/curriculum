// Needs your attention (10 Nov 2026) — the top of the Overview tab and of the weekly summary email:
// one short list of what wants doing, pulled from every tab, each with where it's fixed. Only items
// with something in them are returned, most pressing first.
//   marking       hand-marked work waiting more than 72 hours to be marked
//   atRisk        learners at risk (last 30 days) nobody has followed up yet (analytics.followups.js)
//   absences      learners absent 3 or more times in the last 14 days
//   unread        learners whose parent (with a login) hasn't opened a report published in the last
//                 30 days (counted from 10 Nov 2026, when report opens began to be recorded)
//   standards     admins: educators below a mentor standard this month
//   concerns      admins: parents' conduct concerns not yet resolved
//   unpaid        learners paused today for an unpaid invoice
//   enquiries     admins: website enquiries still New after 2 days

const db = require("../../config/db");
const { inChunks, kenyaDay, addDays, startOfKenyaDay, endOfKenyaDay, json } = require("./analytics.utils");
const { getAtRisk } = require("./analytics.risk");

const MARKING_HOURS = 72;
const VIEWS_RECORDED_FROM = "2026-11-10";

// The same scope over a fixed recent window, whatever period the page has.
const withPeriod = (scope, days) => {
  const to = kenyaDay(new Date());
  const from = addDays(to, -(days - 1));
  const prevTo = addDays(from, -1);
  const prevFrom = addDays(prevTo, -(days - 1));
  return { ...scope, period: { from, to, days, prevFrom, prevTo, start: startOfKenyaDay(from), end: endOfKenyaDay(to), prevStart: startOfKenyaDay(prevFrom), prevEnd: endOfKenyaDay(prevTo) } };
};

async function getAttention(scope) {
  const learnerIds = [...scope.learnerIds];
  const items = [];
  const add = (item) => { if (item.count > 0) items.push(item); };

  // Marking waiting.
  const cutoff = new Date(Date.now() - MARKING_HOURS * 3600000);
  const waiting = await inChunks(learnerIds, (ids) => db("assessment_submissions").whereIn("learnerId", ids).where({ status: "submitted" })
    .where("requiresManualGrading", true).where("submittedAt", "<", cutoff).select("submittedAt"));
  const oldest = waiting.reduce((m, s) => Math.min(m, new Date(s.submittedAt).getTime()), Infinity);
  add({ key: "marking", tone: "danger", icon: "edit", count: waiting.length,
    label: waiting.length === 1 ? "piece of work waiting over 72 hours to be marked" : "pieces of work waiting over 72 hours to be marked",
    detail: Number.isFinite(oldest) ? `Oldest handed in ${Math.floor((Date.now() - oldest) / 86400000)} days ago` : null, tab: "assessments" });

  // At risk, not followed up.
  const risk = await getAtRisk(withPeriod(scope, 30));
  const notFollowed = risk.learners.filter((r) => !r.followUp);
  add({ key: "atRisk", tone: "danger", icon: "alert", count: notFollowed.length,
    label: notFollowed.length === 1 ? "learner at risk not followed up" : "learners at risk not followed up",
    detail: risk.atRiskCount > notFollowed.length ? `${risk.atRiskCount - notFollowed.length} more already followed up` : null, tab: "at-risk" });

  // Repeated absences, last 14 days.
  const recent = withPeriod(scope, 14);
  const att = await inChunks(learnerIds, (ids) => db("attendance").whereIn("learnerId", ids).where({ status: "absent" })
    .whereIn("classId", scope.classIds.length ? scope.classIds : ["-"])
    .whereBetween("date", [recent.period.from, recent.period.to]).select("learnerId"));
  const absentCount = new Map();
  for (const a of att) absentCount.set(a.learnerId, (absentCount.get(a.learnerId) || 0) + 1);
  const repeated = [...absentCount.values()].filter((n) => n >= 3).length;
  add({ key: "absences", tone: "waiting", icon: "calendar", count: repeated,
    label: repeated === 1 ? "learner absent 3+ times in two weeks" : "learners absent 3+ times in two weeks", detail: null, tab: "attendance" });

  // Reports parents haven't opened.
  const since = new Date(Math.max(Date.now() - 30 * 86400000, startOfKenyaDay(VIEWS_RECORDED_FROM).getTime()));
  const reports = await inChunks(learnerIds, (ids) => db("reports").whereIn("learnerId", ids).where({ status: "published" })
    .whereIn("classId", scope.classIds.length ? scope.classIds : ["-"])
    .where("publishedAt", ">=", since).where("publishedAt", "<", new Date(Date.now() - 2 * 86400000)).select("id", "learnerId"));
  const opened = new Set((await inChunks(reports.map((r) => r.id), (ids) => db("report_views").whereIn("reportId", ids).where({ viewer: "parent" }).select("reportId"))).map((r) => r.reportId));
  const unreadLearners = new Set(reports.filter((r) => !opened.has(r.id)).map((r) => r.learnerId));
  const withParentLogin = [];
  if (unreadLearners.size) {
    const emails = [...new Set([...unreadLearners].map((id) => String(scope.learnerById.get(id)?.guardianEmail || "").toLowerCase()).filter(Boolean))];
    const logins = new Set((await inChunks(emails, (e) => db("users").whereIn(db.raw("LOWER(email)"), e).select("email"))).map((u) => String(u.email).toLowerCase()));
    for (const id of unreadLearners) if (logins.has(String(scope.learnerById.get(id)?.guardianEmail || "").toLowerCase())) withParentLogin.push(id);
  }
  add({ key: "unread", tone: "info", icon: "eye", count: withParentLogin.length,
    label: withParentLogin.length === 1 ? "family hasn't opened a new report" : "families haven't opened a new report", detail: null, tab: "parents" });

  if (!scope.isHubView && scope.ownerAdminId) {
    const month = kenyaDay(new Date()).slice(0, 7);
    const snaps = await db("mentor_standard_snapshots").where({ ownerAdminId: scope.ownerAdminId, month }).select("standing");
    const below = snaps.filter((s) => (json(s.standing) || {}).overall === "below").length;
    add({ key: "standards", tone: "waiting", icon: "target", count: below,
      label: below === 1 ? "educator below a mentor standard" : "educators below a mentor standard", detail: null, tab: "educators" });

    const concerns = (await db("mentor_reviews").where({ ownerAdminId: scope.ownerAdminId }).where("concern", true).whereNull("concernResolvedAt").count({ n: "*" }).first()).n;
    add({ key: "concerns", tone: "danger", icon: "flag", count: Number(concerns) || 0,
      label: Number(concerns) === 1 ? "parent concern about an educator to resolve" : "parent concerns about educators to resolve", detail: null, tab: "parent-feedback" });
  }

  const paused = (await inChunks(learnerIds, (ids) => db("billing_access_pauses").whereIn("learnerId", ids).whereNull("resumedAt").distinct("learnerId"))).length;
  add({ key: "unpaid", tone: "waiting", icon: "card", count: paused,
    label: paused === 1 ? "learner paused for an unpaid invoice" : "learners paused for an unpaid invoice", detail: null,
    path: scope.isHubView ? null : "/billing" });

  if (!scope.isHubView) {
    const hubSet = new Set(scope.hubIds);
    const newOnes = (await db("leads").where({ status: "new" }).whereNull("anonymisedAt").where("createdAt", "<", new Date(Date.now() - 2 * 86400000)).select("hubId"))
      .filter((l) => (l.hubId ? hubSet.has(l.hubId) : !scope.filters.hubId)).length;
    add({ key: "enquiries", tone: "info", icon: "inbox", count: newOnes,
      label: newOnes === 1 ? "website enquiry still New after 2 days" : "website enquiries still New after 2 days", detail: null, path: "/enquiries" });
  }

  const order = { danger: 0, waiting: 1, info: 2 };
  items.sort((a, b) => order[a.tone] - order[b.tone] || b.count - a.count);
  return { items, checkedAt: new Date().toISOString() };
}

module.exports = { getAttention, withPeriod };
