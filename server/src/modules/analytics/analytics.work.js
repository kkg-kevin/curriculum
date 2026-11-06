// The work in scope: every assessment issued to the scope's classes or learners in a period, each
// learner's "task" on it (one per learner it was issued to), and what became of it — started,
// handed in (on time / late), marked, released, or missed. Shared by Time to task, Assessments
// and At risk.
//
// A group-mode issue counts a learner's task as done when their group handed in. Work issued by
// the website (diagnostics taken before enrolling, copied onto the record) is left out — it was
// never "issued" to anyone.

const db = require("../../config/db");
const { endOfKenyaDay, hoursBetween, inChunks, json } = require("./analytics.utils");
const CountedWork = require("../assessments/submissions/counted-work");
const AssessmentIssueModel = require("../assessments/submissions/assessment-issue.model");

async function loadWork(scope, start, end) {
  const learnerIds = [...scope.learnerIds];
  const classIds = scope.classIds;
  const issues = (await inChunks([...classIds, ...learnerIds], async (ids) => {
    const set = new Set(ids);
    const cls = ids.filter((id) => scope.classById.has(id));
    const lrn = ids.filter((id) => !scope.classById.has(id) && set.has(id));
    return db("assessment_issues")
      .where((w) => {
        if (cls.length) w.orWhereIn("classId", cls);
        if (lrn.length) w.orWhereIn("learnerId", lrn);
        if (!cls.length && !lrn.length) w.whereRaw("1 = 0");
      })
      .whereNot("issuedBy", "website")
      .whereBetween("issuedAt", [start, end]);
  }))
    .filter((i) => !scope.filters.courseId || i.courseId === scope.filters.courseId);
  const uniqueIssues = [...new Map(issues.map((i) => [i.id, i])).values()];

  // Who each issue went to: its learner, else the class's learners in scope.
  const learnersByClass = new Map();
  for (const l of scope.links) {
    if (!l.classId) continue;
    (learnersByClass.get(l.classId) || learnersByClass.set(l.classId, new Set()).get(l.classId)).add(l.learnerId);
  }

  const issueIds = uniqueIssues.map((i) => i.id);
  const subs = await inChunks(issueIds, (ids) => db("assessment_submissions").whereIn("issueId", ids)
    .select("id", "issueId", "assessmentId", "learnerId", "classId", "status", "totalScore", "maxScore", "requiresManualGrading", "submittedAt", "gradedAt", "gradedBy", "reportPublished", "reportPublishedAt", "createdAt", "groupId", "autoItemResults"));
  const subByKey = new Map(subs.map((s) => [`${s.issueId}:${s.learnerId}`, s]));

  // Group members, for group-mode issues.
  const groupIds = [...new Set(subs.map((s) => s.groupId).filter(Boolean))];
  const members = await inChunks(groupIds, (ids) => db("class_group_members").whereIn("groupId", ids));
  const groupSubByIssueLearner = new Map();
  for (const s of subs) {
    if (!s.groupId) continue;
    for (const m of members.filter((x) => x.groupId === s.groupId)) groupSubByIssueLearner.set(`${s.issueId}:${m.learnerId}`, s);
  }

  const assessmentIds = [...new Set(uniqueIssues.map((i) => i.assessmentId))];
  const assessments = await inChunks(assessmentIds, (ids) => db("assessments").whereIn("id", ids).select("id", "name", "type", "items"));
  const assessmentById = new Map(assessments.map((a) => [a.id, { ...a, items: json(a.items) || [] }]));
  const courseIds = [...new Set(uniqueIssues.map((i) => i.courseId).filter(Boolean))];
  const courses = await inChunks(courseIds, (ids) => db("courses").whereIn("id", ids).select("id", "name"));
  const courseById = new Map(courses.map((c) => [c.id, c]));

  // Revoked for chosen learners (assessment_revocations, keyed by the class issue): no task for
  // them on it, nor on any reissue of it. A reissue's class issue is found by walking up its chain
  // — loaded from the database, so a class issue older than the period still counts
  // (counted-work.js). A reissue whose earlier attempt is gone isn't a task at all.
  // Reissued: a learner's attempt that a later one in the period replaces isn't a task of its own —
  // one task per learner per class issue, their latest (as in reports).
  const revokedPairs = new Set((await inChunks(learnerIds, (ids) => db("assessment_revocations").whereIn("learnerId", ids).select("issueId", "learnerId")))
    .map((r) => `${r.issueId}:${r.learnerId}`));
  const chains = await CountedWork.loadIssueChains(uniqueIssues.filter((i) => i.reissuedFromIssueId).map((i) => i.id));
  const rootIdOf = (issue) => {
    if (!issue.reissuedFromIssueId) return issue.id;
    const chain = CountedWork.chainOf(chains.get(issue.id) || issue, chains);
    return chain ? chain.root.id : null;
  };
  const superseded = new Set(uniqueIssues.filter((i) => i.reissuedFromIssueId && i.learnerId).map((i) => `${i.reissuedFromIssueId}:${i.learnerId}`));

  const now = Date.now();
  const tasks = [];
  for (const issue of uniqueIssues) {
    const rootId = rootIdOf(issue);
    if (!rootId) continue;
    const recipients = (issue.learnerId
      ? (scope.learnerIds.has(issue.learnerId) ? [issue.learnerId] : [])
      : [...(learnersByClass.get(issue.classId) || [])])
      .filter((learnerId) => !revokedPairs.has(`${rootId}:${learnerId}`) && !superseded.has(`${issue.id}:${learnerId}`)
        // Issued to chosen learners only: a task for them alone.
        && AssessmentIssueModel.isForLearner(issue, learnerId));
    const dueEnd = issue.dueDate ? endOfKenyaDay(String(issue.dueDate).slice(0, 10)) : null;
    for (const learnerId of recipients) {
      const sub = subByKey.get(`${issue.id}:${learnerId}`) || groupSubByIssueLearner.get(`${issue.id}:${learnerId}`) || null;
      const handedIn = Boolean(sub?.submittedAt) || sub?.status === "graded";
      const submittedAt = sub?.submittedAt || (sub?.status === "graded" ? sub.gradedAt : null);
      let timing = "pending";
      if (handedIn) timing = !dueEnd ? "no_due" : new Date(submittedAt) <= dueEnd ? "on_time" : "late";
      else if (dueEnd && dueEnd.getTime() < now) timing = "missed";
      tasks.push({
        issue,
        learnerId,
        sub,
        started: Boolean(sub),
        handedIn,
        marked: sub?.status === "graded",
        released: Boolean(sub?.reportPublished),
        timing,
        dueEnd,
        percent: sub?.status === "graded" && sub.maxScore > 0 ? Math.min(100, Math.round((sub.totalScore / sub.maxScore) * 100)) : null,
        // Hours between the steps.
        toStart: sub ? hoursBetween(issue.issuedAt, sub.createdAt) : null,
        toHandIn: handedIn && sub ? hoursBetween(sub.createdAt, submittedAt) : null,
        issuedToHandIn: handedIn ? hoursBetween(issue.issuedAt, submittedAt) : null,
        toMark: sub?.status === "graded" && sub.requiresManualGrading ? hoursBetween(submittedAt, sub.gradedAt) : null,
        toRelease: sub?.reportPublished && sub.gradedAt ? hoursBetween(sub.gradedAt, sub.reportPublishedAt) : null,
      });
    }
  }
  return { issues: uniqueIssues, tasks, subs, assessmentById, courseById };
}

// People behind ids that may be an educator's id or a login's id (gradedBy, issuedBy).
async function namesFor(ids) {
  const list = [...new Set(ids)].filter((id) => id && id !== "system" && id !== "website");
  const teachers = await inChunks(list, (x) => db("teachers").whereIn("id", x).select("id", "firstName", "lastName"));
  const users = await inChunks(list, (x) => db("users").whereIn("id", x).select("id", "name", "email"));
  const names = new Map();
  teachers.forEach((t) => names.set(t.id, { name: [t.firstName, t.lastName].filter(Boolean).join(" "), teacherId: t.id }));
  users.forEach((u) => { if (!names.has(u.id)) names.set(u.id, { name: u.name || u.email, teacherId: null }); });
  return names;
}

module.exports = { loadWork, namesFor };
