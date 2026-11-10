// A learner's assessment activity over the last year, by day (10 Nov 2026) — the GitHub-style
// grid on their profile. Read only, worked out from their submissions each time; nothing stored.
//
// Each piece of work is one entry, on the day the learner last did something with it: the day they
// handed it in, else (still a draft) the day they last saved it; an observation (started by the
// teacher) on the day it was marked. Its state is what the learner may know: marked work whose
// result isn't released yet still reads "waiting for marking" (as redactUnpublishedReport does),
// and work revoked for them, or whose issue was revoked for everyone, reads "taken back" with no
// link. Each entry carries what to open: the assessment (its issue) and, when one is published,
// the session's report — "so far" while the session still has work to mark.

const db = require("../../../config/db");
const AssessmentRevocationModel = require("./assessment-revocation.model");

const DAYS = 371; // 53 weeks, like GitHub's year

const pad = (n) => String(n).padStart(2, "0");
// The Kenyan calendar day (EAT, UTC+3) of a moment, "YYYY-MM-DD".
function kenyaDay(value) {
  if (!value) return null;
  const t = new Date(value).getTime();
  if (!Number.isFinite(t)) return null;
  const d = new Date(t + 3 * 60 * 60 * 1000);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

function stateOf(sub, { revoked }) {
  if (revoked) return "revoked";
  if (sub.status === "draft" || sub.status === "in_progress") return "in_progress";
  if (sub.status === "graded" && sub.reportPublished) return "marked";
  return "waiting";
}

const LearnerActivityService = {
  kenyaDay,

  // `classIds` (a Set) limits it to work of those classes, for staff who may only see their own
  // hubs' classes; null = everything (the learner themself, or their parent).
  async forLearner(learnerId, { classIds = null, now = new Date() } = {}) {
    const to = kenyaDay(now);
    const fromDate = new Date(now.getTime() - (DAYS - 1) * 86400000);
    const from = kenyaDay(fromDate);
    const since = new Date(fromDate.getTime() - 86400000); // a day's margin for the time zone

    const subs = await db("assessment_submissions")
      .where({ learnerId })
      .where((q) => q.where("submittedAt", ">=", since).orWhere("updatedAt", ">=", since).orWhere("gradedAt", ">=", since))
      .select("id", "issueId", "assessmentId", "classId", "status", "totalScore", "maxScore", "submittedAt", "gradedAt", "reportPublished", "createdAt", "updatedAt");
    if (!subs.length) return { from, to, entries: [] };

    const issueIds = [...new Set(subs.map((s) => s.issueId).filter(Boolean))];
    const issues = issueIds.length
      ? await db("assessment_issues").whereIn("id", issueIds).select("id", "classId", "sessionId", "courseId", "reissuedFromIssueId", "ageCategoryId", "pathwayId")
      : [];
    const issueById = new Map(issues.map((i) => [i.id, i]));
    const revokedIds = await AssessmentRevocationModel.revokedIssueIds(learnerId);

    const visible = subs.filter((s) => {
      if (!classIds) return true;
      const issue = issueById.get(s.issueId);
      const classId = issue?.classId || s.classId || null;
      // A reissue (no class of its own) follows its submission's class; work with no class at all
      // (a diagnostic, a pathway learner's own issue) belongs to the learner wherever they are.
      return !classId || classIds.has(classId);
    });

    const assessmentIds = [...new Set(visible.map((s) => s.assessmentId).filter(Boolean))];
    const assessments = assessmentIds.length ? await db("assessments").whereIn("id", assessmentIds).select("id", "name", "type") : [];
    const assessmentById = new Map(assessments.map((a) => [a.id, a]));
    const sessionIds = [...new Set(visible.map((s) => issueById.get(s.issueId)?.sessionId).filter(Boolean))];
    const sessions = sessionIds.length ? await db("course_sessions").whereIn("id", sessionIds).select("id", "title", "courseId") : [];
    const sessionById = new Map(sessions.map((s) => [s.id, s]));
    const courseIds = [...new Set([...sessions.map((s) => s.courseId), ...visible.map((s) => issueById.get(s.issueId)?.courseId)].filter(Boolean))];
    const courses = courseIds.length ? await db("courses").whereIn("id", courseIds).select("id", "name") : [];
    const courseById = new Map(courses.map((c) => [c.id, c]));

    // Published session reports of those sessions — what "See the report" opens.
    const reports = sessionIds.length
      ? await db("reports").where({ learnerId, status: "published" }).whereIn("sessionId", sessionIds).select("id", "sessionId", "classId", "content", "publishedAt")
      : [];
    const reportBySession = new Map();
    for (const r of reports) {
      const prev = reportBySession.get(r.sessionId);
      if (!prev || new Date(r.publishedAt || 0) > new Date(prev.publishedAt || 0)) reportBySession.set(r.sessionId, r);
    }

    const entries = [];
    for (const s of visible) {
      const issue = issueById.get(s.issueId);
      const revoked = !issue || revokedIds.has(s.issueId);
      const state = stateOf(s, { revoked });
      const when = s.submittedAt || (state === "in_progress" ? s.updatedAt || s.createdAt : s.gradedAt || s.updatedAt || s.createdAt);
      const date = kenyaDay(when);
      if (!date || date < from || date > to) continue;
      const assessment = assessmentById.get(s.assessmentId);
      const session = issue?.sessionId ? sessionById.get(issue.sessionId) : null;
      const course = courseById.get(session?.courseId || issue?.courseId);
      const report = !revoked && issue?.sessionId ? reportBySession.get(issue.sessionId) : null;
      let content = report?.content;
      if (typeof content === "string") { try { content = JSON.parse(content); } catch { content = null; } }
      const marked = state === "marked";
      entries.push({
        id: s.id,
        date,
        at: when,
        state,
        issueId: revoked ? null : s.issueId,
        assessmentName: assessment?.name || "An assessment",
        assessmentType: assessment?.type || null,
        diagnostic: Boolean(issue?.ageCategoryId || issue?.pathwayId),
        reissue: Boolean(issue?.reissuedFromIssueId),
        sessionTitle: session?.title || null,
        courseName: course?.name || null,
        submittedAt: s.submittedAt || null,
        markedAt: marked ? s.gradedAt : null,
        percent: marked && Number(s.maxScore) > 0 ? Math.round((Number(s.totalScore || 0) / Number(s.maxScore)) * 100) : null,
        reportId: report?.id || null,
        reportSoFar: report ? content?.complete === false : false,
      });
    }
    entries.sort((a, b) => (a.date === b.date ? new Date(b.at || 0) - new Date(a.at || 0) : a.date < b.date ? 1 : -1));
    return { from, to, entries };
  },
};

module.exports = LearnerActivityService;
