const ReportModel = require("./report.model");
const SessionModel = require("../courses/session.model");
const { getSessionAssessmentIds } = require("../courses/sessionAssessment.utils");
const ClassModel = require("../classes/class.model");
const LearningHubModel = require("../learning-hubs/learning-hub.model");
const CourseModel = require("../courses/course.model");
const ModuleModel = require("../courses/module.model");
const LearnerModel = require("../learners/learner.model");
const LearnerHubLinkModel = require("../learners/learner-hub-link.model");
const AssessmentModel = require("../assessments/assessment.model");
const { computeEntryMarks } = require("../assessments/assessment.utils");
const AssessmentRevocationModel = require("../assessments/submissions/assessment-revocation.model");
const CountedWork = require("../assessments/submissions/counted-work");
const AssessmentIssueModel = require("../assessments/submissions/assessment-issue.model");
const AssessmentSubmissionService = require("../assessments/submissions/assessment-submission.service");
const CompetencyService = require("../curriculum/competency-framework/competency.service");
const AttendanceModel = require("../attendance/attendance.model");
const NotificationService = require("../notifications/notification.service");
const CertificateService = require("../certificates/certificate.service");
const CurriculumVersionService = require("../curriculum/versions/curriculum-versions.service");
const db = require("../../config/db");
const { sessionNumbering, placeFields } = require("../courses/session-numbering");

function notFound(message) {
  const err = new Error(message);
  err.statusCode = 404;
  throw err;
}

async function getExpectedCourseCompletions(classes, activeLinks) {
  const activeByClass = {};
  activeLinks.forEach((link) => {
    if (link.classId) activeByClass[link.classId] = (activeByClass[link.classId] || 0) + 1;
  });
  const courseCounts = await Promise.all(classes.map(async (cls) => {
    const courses = await CurriculumVersionService.getCurrentCourses(cls.curriculumId, cls.gradeId);
    return { classId: cls.id, count: courses.length };
  }));
  const expectedByClass = Object.fromEntries(courseCounts.map((row) => [
    row.classId,
    (activeByClass[row.classId] || 0) * row.count,
  ]));
  const expected = Object.values(expectedByClass).reduce((sum, count) => sum + count, 0);
  return { expected, expectedByClass, activeByClass };
}

function buildCompletionStats(publishedFinals, expected) {
  const completed = publishedFinals.length;
  return {
    completed,
    expected,
    rate: expected > 0 ? Math.round((completed / expected) * 100) : null,
  };
}

// Every assessment a learner needs graded for a course to be report-eligible — a course's
// content is a list of Sessions, each of which may carry its own attached assessment(s) (see
// sessionAssessment.utils.js), so this is the union of every session's attachments. Filtered to
// assessments that still actually exist — a session can keep referencing an assessment's id after
// that assessment was deleted (attachment records aren't cleaned up on delete), and treating a
// dead reference as "required" would make the course permanently unable to reach "ready" for any
// learner, since a deleted assessment can never be graded.
async function getCourseRequiredAssessmentIds(courseId) {
  return (await getCourseAssessmentCounts(courseId)).requiredIds;
}

// Both the attached ids and the subset that still resolves to a real assessment. Callers that
// only need the requirement use getCourseRequiredAssessmentIds above; the readiness view also
// wants `attachedCount` so it can explain a course whose requirement silently shrank (or hit
// zero) because assessments were deleted out from under its sessions.
async function getCourseAssessmentCounts(courseId) {
  const sessions = await SessionModel.findByCourseId(courseId);
  const ids = new Set();
  sessions.forEach((session) => getSessionAssessmentIds(session).forEach((id) => ids.add(id)));
  const attachedIds = [...ids];
  const found = await Promise.all(attachedIds.map((id) => AssessmentModel.findById(id)));
  return {
    attachedIds,
    attachedCount: attachedIds.length,
    requiredIds: attachedIds.filter((id, i) => !!found[i]),
  };
}

// Same "still exists" filter as getCourseAssessmentCounts, scoped to one session's own attached
// assessments — the unit a session report is built from.
// The answer barely ever changes (an assessment deleted), but one Reports page asks it for every
// learner × session × check — so it's kept for a few seconds (19 Nov 2026: ~1,200 queries for a
// 6-learner class without it).
const requiredIdsCache = new Map();
const REQUIRED_IDS_TTL_MS = 10 * 1000;
async function getSessionRequiredAssessmentIds(session) {
  const ids = getSessionAssessmentIds(session);
  if (!ids.length) return ids;
  const key = ids.join(",");
  const hit = requiredIdsCache.get(key);
  if (hit && Date.now() - hit.at < REQUIRED_IDS_TTL_MS) return hit.ids;
  const found = await Promise.all(ids.map((id) => AssessmentModel.findById(id)));
  const result = ids.filter((id, i) => !!found[i]);
  if (requiredIdsCache.size > 5000) requiredIdsCache.clear();
  requiredIdsCache.set(key, { at: Date.now(), ids: result });
  return result;
}

// Which work counts is one rule for every report (assessments/submissions/counted-work.js): its
// issue still stands, it isn't revoked for the learner, only their latest attempt at a class issue
// counts (reissue chain order), and only once its report is released — so a report never reveals
// a score the learner hasn't seen on that assessment's own page. Work counts in the session it was
// issued for, never in another session that happens to attach the same assessment.
// `forSession(sessionId)` → the assessment ids done in that session.
function getPublishedGraded(learnerId) {
  return CountedWork.publishedGradedBySession(learnerId);
}

// A session's required assessments for one learner: those revoked for them alone are no longer
// asked of them (their session and course can still finish).
// Nor are those the class issued to chosen learners only, without them (6 Nov 2026).
// A class's revocations and chosen-learner issues, held for a few seconds (19 Nov 2026): a Reports
// page asks for them per learner × session × check. Short enough that a change shows almost at once.
const CLASS_LOOKUP_TTL_MS = 5 * 1000;
const classLookupCache = new Map();
async function classLookup(kind, classId, load) {
  const key = `${kind}:${classId}`;
  const hit = classLookupCache.get(key);
  if (hit && Date.now() - hit.at < CLASS_LOOKUP_TTL_MS) return hit.value;
  const value = await load();
  if (classLookupCache.size > 2000) classLookupCache.clear();
  classLookupCache.set(key, { at: Date.now(), value });
  return value;
}

async function getLearnerRequiredAssessmentIds(session, learnerId, classId) {
  const ids = await getSessionRequiredAssessmentIds(session);
  if (!ids.length || !learnerId) return ids;
  const revocations = classId
    ? await classLookup("revocations", classId, () => db("assessment_revocations").where({ classId }).select("learnerId", "sessionId", "assessmentId"))
    : null;
  const revoked = revocations
    ? new Set(revocations.filter((r) => r.learnerId === learnerId && r.sessionId === session.id).map((r) => r.assessmentId))
    : await AssessmentRevocationModel.revokedAssessmentIds(learnerId, classId, session.id);
  const notTheirs = await notIssuedToThem(learnerId, classId, session.id);
  return revoked.size || notTheirs.size ? ids.filter((id) => !revoked.has(id) && !notTheirs.has(id)) : ids;
}

// The assessments this class issued to chosen learners only, leaving this learner out — in one
// session, or (no sessionId) anywhere in the class.
async function notIssuedToThem(learnerId, classId, sessionId = null) {
  if (!classId || !learnerId) return new Set();
  const all = await classLookup("chosen-issues", classId, () => db("assessment_issues").where({ classId }).whereNotNull("forLearnerIds").select("assessmentId", "forLearnerIds", "sessionId"));
  const rows = sessionId ? all.filter((r) => r.sessionId === sessionId) : all;
  return new Set(rows.filter((r) => !AssessmentIssueModel.isForLearner(r, learnerId)).map((r) => r.assessmentId));
}

async function buildReportContent(learnerId, requiredAssessmentIds, curriculumId, courseId, sessionId = null, scopeSessionIds = null) {
  // The work that counts (counted-work.js — a reissued assessment's latest released attempt), from
  // this session only, a module report's sessions (scopeSessionIds), or for a course report from
  // the course's sessions.
  const sessionIds = sessionId
    ? new Set([sessionId])
    : scopeSessionIds
      ? new Set(scopeSessionIds)
      : new Set((await SessionModel.findByCourseId(courseId)).map((s) => s.id));
  const { counted } = await CountedWork.sortLearnerWork(learnerId, { published: true });
  // One piece of work per assessment (the same assessment issued twice in a course — the latest marked).
  const latestByAssessment = new Map();
  counted
    .filter((entry) => requiredAssessmentIds.includes(entry.submission.assessmentId) && CountedWork.inSessions(entry, sessionIds))
    .forEach(({ submission: s }) => {
      const held = latestByAssessment.get(s.assessmentId);
      if (!held || new Date(s.gradedAt || 0) > new Date(held.gradedAt || 0)) latestByAssessment.set(s.assessmentId, s);
    });
  const submissions = [...latestByAssessment.values()];

  const assessments = await Promise.all(submissions.map(async (s) => {
    const assessment = await AssessmentModel.findById(s.assessmentId);
    const maxScore = s.maxScore || 0;
    const totalScore = s.totalScore || 0;
    return {
      assessmentId: s.assessmentId,
      // The issue the learner answered — the report links to their marked work with it.
      issueId: s.issueId || null,
      name: assessment?.name || "Untitled assessment",
      type: assessment?.type || null,
      totalScore,
      maxScore,
      percent: maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0,
      gradedAt: s.gradedAt,
      // Who graded it — see AssessmentSubmissionService.resolveGraderName for the Teacher-id-or-
      // Users-id resolution. Surfaced alongside gradedAt so feedback in a report always reads
      // with "who said this, and when" rather than just the comment on its own.
      ...(await (async () => {
        const grader = await AssessmentSubmissionService.resolveGrader(s.gradedBy);
        return { gradedByName: grader.name, gradedByPhoto: grader.photo };
      })()),
      // The teacher's written comment from grading (GradingPanel.jsx) — never surfaced anywhere
      // in the report before; without it a report showed only a number, not what the teacher
      // actually said about the work.
      feedback: s.overallFeedback || "",
      // A project's milestones (16 Nov 2026): each with its marks and the educator's note, in order.
      ...(assessment?.type === "project" && (assessment.milestones || []).length ? {
        milestones: [...assessment.milestones].sort((a, b) => (a.order || 0) - (b.order || 0)).map((m) => {
          const p = (s.milestoneProgress || []).find((e) => e.milestoneId === m.id);
          const max = computeEntryMarks(m);
          return { id: m.id, name: m.name, marked: Boolean(p), marks: p ? Number(p.marks) || 0 : 0, max, percent: max > 0 && p ? Math.round(((Number(p.marks) || 0) / max) * 100) : 0, feedback: p?.feedback || "" };
        }),
      } : {}),
    };
  }));

  // Marks-weighted across the course's assessments, not an average of each assessment's own
  // percentage — assessments can carry very different max scores, so a flat average would let a
  // 5-mark quiz outweigh a 100-mark exam.
  const sumTotal = assessments.reduce((sum, a) => sum + a.totalScore, 0);
  const sumMax = assessments.reduce((sum, a) => sum + a.maxScore, 0);
  const overall = {
    totalScore: sumTotal,
    maxScore: sumMax,
    percent: sumMax > 0 ? Math.round((sumTotal / sumMax) * 100) : 0,
  };

  const indicatorBreakdown = await AssessmentSubmissionService.getLearnerIndicatorProgressForAssessments(
    learnerId,
    requiredAssessmentIds,
    curriculumId,
    sessionIds
  );

  // The curriculum's own score/level/band per competency — a different number from the flat
  // indicatorBreakdown above, same pair shown together on the graded assessment view and the
  // Profile Competencies tab. Scoped to THIS course's assessments, matching indicatorBreakdown:
  // a course report shouldn't fold in competency standing the learner earned on other courses.
  const competencyScores = curriculumId
    ? await CompetencyService.getLearnerCompetencyScoresForAssessments(curriculumId, learnerId, requiredAssessmentIds, sessionIds)
    : [];

  // Snapshotted at generate time like everything else here, so neither the learner's report list
  // nor the report itself has to fetch the course separately just to render its name — and a
  // course later renamed or deleted doesn't retitle/blank an already-published report.
  const course = courseId ? await CourseModel.findById(courseId) : null;
  const courseName = course?.name || null;

  // Same snapshotting reasoning as courseName, for a session report specifically — null for a
  // course-level final report.
  const session = sessionId ? await SessionModel.findById(sessionId) : null;
  const sessionName = session?.title || null;

  return { assessments, overall, indicatorBreakdown, competencyScores, courseName, sessionName };
}

// A session's place in its course — modules in order, then sessions in order within each — and
// the one after it: { sessionNumber, sessionCount, sessionModuleName, nextSessionTitle }. Since
// 19 Nov 2026 the number and count are within the session's module (Module 2 starts at 1 again).
async function sessionPlace(session) {
  const [modules, sessions] = await Promise.all([
    db("course_modules").where({ courseId: session.courseId }).select("id", "order"),
    SessionModel.findByCourseId(session.courseId),
  ]);
  const moduleOrder = new Map(modules.map((m) => [m.id, Number(m.order) || 0]));
  const ordered = [...sessions].sort((a, b) =>
    (moduleOrder.get(a.moduleId) ?? 1e9) - (moduleOrder.get(b.moduleId) ?? 1e9) || (Number(a.order) || 0) - (Number(b.order) || 0));
  const index = ordered.findIndex((s) => s.id === session.id);
  if (index < 0) return {};
  const place = placeFields(await sessionNumbering(session.courseId), session.id);
  return {
    sessionNumber: place.sessionNumber ?? index + 1,
    sessionCount: place.sessionCount ?? ordered.length,
    sessionModuleName: place.moduleName,
    nextSessionTitle: ordered[index + 1]?.title || null,
  };
}

// A session is DONE for a learner once its report stands and either every assessment it attaches
// is marked and released, or the educator filed it "not submitted". A session report itself goes
// out as soon as one assessment is marked (generateSessionReport) — so "has a report" no longer
// means "done", and nothing that counts finished sessions may treat it that way.
function sessionDone(report, requiredIds, gradedIds) {
  if (report?.status !== "published") return false;
  return Boolean(report.content?.notSubmitted) || requiredIds.every((id) => gradedIds.has(id));
}

// True once every one of the course's non-empty sessions (sessions with at least one still-
// existing attached assessment) is done for this learner (sessionDone) — the gate a course's
// "final" report has to clear. A course with zero non-empty sessions is never ready (nothing to
// report), matching prior behavior.
async function isCourseReadyForLearner(courseId, classId, learnerId) {
  const allSessions = await SessionModel.findByCourseId(courseId);
  const requiredPerSession = await Promise.all(allSessions.map((s) => getLearnerRequiredAssessmentIds(s, learnerId, classId)));
  const sessions = allSessions.map((s, i) => ({ session: s, requiredIds: requiredPerSession[i] })).filter((x) => x.requiredIds.length > 0);
  if (sessions.length === 0) return false;
  const graded = await getPublishedGraded(learnerId);
  const reports = await Promise.all(sessions.map(({ session }) => ReportModel.findOne({ learnerId, courseId, classId, sessionId: session.id })));
  return sessions.every(({ session, requiredIds }, i) => sessionDone(reports[i], requiredIds, graded.forSession(session.id)));
}

// Builds/refreshes a single session's report for one learner, published in the same step — no
// separate teacher click, no draft stage, unlike the course-level final report below. It goes out
// as soon as ONE of the session's assessments is marked and released (3 Nov 2026: learners see
// each mark as it lands) and is updated as each further one is; `content.complete` /
// `content.pendingCount` say how much is still to be marked. Run straight after marking
// (refreshSessionReportsForAssessment, called from assessment-submission.service.js) and as a
// side effect of the readiness checks, so it must never throw. A report left with nothing marked
// (its only work was revoked) is removed. A not-submitted report stands until everything is marked.
async function generateSessionReport({ learnerId, session, classId, curriculumId }) {
  const requiredIds = await getLearnerRequiredAssessmentIds(session, learnerId, classId);
  if (requiredIds.length === 0) {
    // Everything here was revoked for them: a report already out (not a not-submitted one) goes.
    const stale = await ReportModel.findOne({ learnerId, courseId: session.courseId, classId, sessionId: session.id });
    if (stale && !stale.content?.notSubmitted) await ReportModel.delete(stale.id);
    return null;
  }

  const existing = await ReportModel.findOne({ learnerId, courseId: session.courseId, classId, sessionId: session.id });
  const gradedIds = (await getPublishedGraded(learnerId)).forSession(session.id);
  const markedCount = requiredIds.filter((id) => gradedIds.has(id)).length;
  const complete = markedCount === requiredIds.length;
  if (existing?.content?.notSubmitted && !complete) return existing;
  if (markedCount === 0) {
    if (existing) await ReportModel.delete(existing.id);
    return null;
  }

  // The marked work behind this report (19 Nov 2026): when it's the same as when the report was
  // last built, there's nothing new — skip the rebuild (a Reports page load runs this for every
  // learner × session). Marking a piece changes the key, so a new mark always rebuilds.
  const { counted } = await CountedWork.sortLearnerWork(learnerId, { published: true });
  const inThis = new Set([session.id]);
  const sourceKey = [
    requiredIds.join(","),
    ...counted.filter((e) => requiredIds.includes(e.submission.assessmentId) && CountedWork.inSessions(e, inThis))
      .map((e) => `${e.submission.id}:${e.submission.gradedAt ? new Date(e.submission.gradedAt).getTime() : ""}:${e.submission.totalScore}:${e.submission.maxScore}`)
      .sort(),
  ].join("|");
  if (existing && existing.content?.sourceKey === sourceKey) return existing;

  const content = {
    ...(await buildReportContent(learnerId, requiredIds, curriculumId, session.courseId, session.id)),
    sourceKey,
    complete,
    pendingCount: requiredIds.length - markedCount,
    // Where the session sits in its course, for the report's "What's next".
    ...(await sessionPlace(session)),
  };
  if (existing) {
    const before = existing.content?.assessments?.length || 0;
    const updated = await ReportModel.update(existing.id, { content });
    // Another of the session's assessments was marked — tell the learner their report grew.
    if (content.assessments.length > before && updated) await NotificationService.sessionReportPublished(updated);
    return updated;
  }

  // hubId mirrors the course-level report's own resolution (cls?.schoolId in generateReport) —
  // listForLearner filters on it for the portal's hub switcher, so a session report left without
  // one would silently vanish from that filtered view even though it's really published.
  const cls = await ClassModel.findById(classId);
  const now = new Date();
  const created = await ReportModel.create({
    learnerId,
    courseId: session.courseId,
    classId,
    sessionId: session.id,
    hubId: cls?.schoolId || null,
    status: "published",
    generatedAt: now,
    generatedBy: "system",
    publishedAt: now,
    publishedBy: "system",
    remarks: "",
    content,
  });
  await NotificationService.sessionReportPublished(created);
  return created;
}

// Lazily triggers session-report generation for every learner in a class, across every session of
// a course — called from the teacher-facing readiness endpoint below (the natural, low-risk place
// to run this) rather than hooked into assessment-submission.service.js's grade(), which would
// create a circular require between the assessments/submissions and reports modules (report.
// service.js already requires AssessmentSubmissionModel/Service, so the reverse direction isn't safe).
async function ensureSessionReportsGenerated(classId, courseId, learnerIds) {
  const sessions = await SessionModel.findByCourseId(courseId);
  const cls = await ClassModel.findById(classId);
  await Promise.all(
    learnerIds.flatMap((learnerId) =>
      sessions.map((session) => generateSessionReport({ learnerId, session, classId, curriculumId: cls?.curriculumId }))
    )
  );
}

// Classifies one (learner, session) pair's outstanding assessment work into exactly one of:
//   ready              — every required assessment graded+published; a real session report
//                        exists or generateSessionReport can build one. Nothing to resolve.
//   needs_grading      — the learner HAS a submission (submitted, or in progress past its due
//                        window) for at least one required assessment that isn't graded yet.
//                        Blocks completion — a teacher must actually grade it.
//   not_submitted      — no submission at all for one or more required assessments, and no
//                        not-submitted report has been filed yet. Resolvable via
//                        markSessionNotSubmitted below.
//   resolved_no_submit — a not-submitted report already stands for this pair. Counts as done.
//   nothing_required   — the session attaches no still-existing assessment. Never blocks.
// Deliberately read-only — it does not itself generate or file anything.
// Per-request memo for the learner-wide lookups classifySessionWork repeats for every session —
// pass one Map through a whole readiness build (19 Nov 2026), or nothing for a single call.
async function memo(cache, key, load) {
  if (!cache) return load();
  if (!cache.has(key)) cache.set(key, load());
  return cache.get(key);
}

// The latest due date among this class's still-open issues of these assessments in this session,
// for this learner — or null when none is still open. dueDate is stored as text ("YYYY-MM-DD",
// sometimes with a time after it), so it's compared as text against today in Kenya: work stays
// open through its due day. No due date counts as not open.
async function stillOpenUntil(learnerId, classId, sessionId, assessmentIds) {
  if (!assessmentIds.length) return null;
  const { todayInKenya } = require("../checkins/checkin.dates");
  const rows = await db("assessment_issues").where({ classId, sessionId }).whereIn("assessmentId", assessmentIds)
    .whereNotNull("dueDate").where("dueDate", ">=", todayInKenya()).select("dueDate", "learnerId", "forLearnerIds");
  const theirs = rows.filter((r) => (!r.learnerId || r.learnerId === learnerId) && AssessmentIssueModel.isForLearner(r, learnerId));
  if (!theirs.length) return null;
  return theirs.map((r) => String(r.dueDate).slice(0, 10)).sort().pop();
}

async function classifySessionWork(learnerId, session, classId, cache = null) {
  const requiredIds = await getLearnerRequiredAssessmentIds(session, learnerId, classId);
  if (requiredIds.length === 0) return { state: "nothing_required", missingAssessmentIds: [], ungraded: [] };

  const existingReport = await ReportModel.findOne({ learnerId, courseId: session.courseId, classId, sessionId: session.id });
  if (existingReport?.content?.notSubmitted) return { state: "resolved_no_submit", missingAssessmentIds: [], ungraded: [] };

  const publishedGradedIds = (await memo(cache, `graded:${learnerId}`, () => getPublishedGraded(learnerId))).forSession(session.id);
  // Only live work for this session (counted-work.js): work on an issue revoked for everyone is
  // gone from here, so its session can be filed "not submitted" or the assessment issued again —
  // it never sits as "needs grading" with nothing in any marking queue. Per assessment, the
  // learner's latest attempt.
  const { live } = await memo(cache, `live:${learnerId}`, () => CountedWork.sortLearnerWork(learnerId));
  const sessionIds = new Set([session.id]);
  const subByAssessment = new Map();
  for (const entry of live.filter((e) => CountedWork.inSessions(e, sessionIds))) {
    const held = subByAssessment.get(entry.submission.assessmentId);
    if (!held || entry.attempt > held.attempt) subByAssessment.set(entry.submission.assessmentId, entry);
  }
  for (const [id, entry] of subByAssessment) subByAssessment.set(id, entry.submission);

  const missingAssessmentIds = [];
  const ungraded = [];
  for (const id of requiredIds) {
    if (publishedGradedIds.has(id)) continue;
    const sub = subByAssessment.get(id);
    if (!sub) missingAssessmentIds.push(id);
    // A submission that exists but hasn't reached graded+published — the teacher owes it a grade
    // (or a publish, if graded-but-unreleased). Either way it's "needs_grading" for our purposes.
    else if (sub.status !== "graded" || !sub.reportPublished) ungraded.push(id);
  }

  if (ungraded.length > 0) return { state: "needs_grading", missingAssessmentIds, ungraded };
  if (missingAssessmentIds.length > 0) {
    // 19 Nov 2026: work not handed in whose due date hasn't passed is "open" — the learner may
    // still hand it in, so it can't be filed "not submitted" yet.
    const openUntil = await stillOpenUntil(learnerId, classId, session.id, missingAssessmentIds);
    if (openUntil) return { state: "open", missingAssessmentIds, ungraded, openUntil };
    return { state: "not_submitted", missingAssessmentIds, ungraded };
  }
  return { state: "ready", missingAssessmentIds: [], ungraded: [] };
}

// Shared by generateReport and publishReport — builds a course-level final report's content
// (the union of every session's required assessments, as buildReportContent always did) and
// attaches a sessionReports summary so the final report visibly shows what it combines.
async function buildCourseReportContent(learnerId, courseId, classId) {
  const requiredAssessmentIds = await getCourseRequiredAssessmentIds(courseId);
  const cls = await ClassModel.findById(classId);
  const content = await buildReportContent(learnerId, requiredAssessmentIds, cls?.curriculumId, courseId);

  const allSessions = await SessionModel.findByCourseId(courseId);
  const requiredPerSession = await Promise.all(allSessions.map((s) => getLearnerRequiredAssessmentIds(s, learnerId, classId)));
  const sessions = allSessions.filter((s, i) => requiredPerSession[i].length > 0);

  content.sessionReports = await sessionReportsFor(sessions, { learnerId, courseId, classId });
  content.missingWork = await missingWorkFor(learnerId, classId, allSessions, content);
  return content;
}

// What a combined (module or course) report leaves out (19 Nov 2026): a report no longer waits for
// every piece of work — the educator generates it at the last session — so it names the work that
// isn't in it: never handed in, or handed in but not marked yet. [{ assessmentId, name,
// sessionTitle, reason: "not_handed_in" | "not_marked" }]
async function missingWorkFor(learnerId, classId, sessions, content) {
  const marked = new Set((content.assessments || []).map((a) => a.assessmentId));
  const { live } = await CountedWork.sortLearnerWork(learnerId);
  const out = [];
  const seen = new Set();
  for (const session of sessions) {
    for (const id of await getLearnerRequiredAssessmentIds(session, learnerId, classId)) {
      if (marked.has(id) || seen.has(id)) continue;
      seen.add(id);
      const inSession = new Set([session.id]);
      const handedIn = live.some((e) => e.submission.assessmentId === id && CountedWork.inSessions(e, inSession) && e.submission.status !== "in_progress");
      const assessment = await AssessmentModel.findById(id);
      out.push({ assessmentId: id, name: assessment?.name || "Assessment", sessionTitle: session.title || null, reason: handedIn ? "not_marked" : "not_handed_in" });
    }
  }
  return out;
}

// The session reports a combined (course or module) report lists, one per assessed session.
function sessionReportsFor(sessions, { learnerId, courseId, classId }) {
  return Promise.all(sessions.map(async (s) => {
    const report = await ReportModel.findOne({ learnerId, courseId, classId, sessionId: s.id });
    return {
      sessionId: s.id,
      sessionTitle: s.title || null,
      reportId: report?.id || null,
      totalScore: report?.content?.overall?.totalScore ?? 0,
      maxScore: report?.content?.overall?.maxScore ?? 0,
      percent: report?.content?.overall?.percent ?? 0,
      publishedAt: report?.publishedAt || null,
    };
  }));
}

// ---- Module reports (19 Nov 2026) -------------------------------------------------------------
// The final combined report, for one module of a course: the module's sessions only. Ready once
// every one of its sessions with something to assess is done (sessionDone) — the course rule,
// over the module. Publishing it issues the module's certificate.

// The module's sessions, in order, and the assessments they attach that still exist.
async function moduleScope(courseId, moduleId) {
  const sessions = (await SessionModel.findByCourseId(courseId)).filter((s) => s.moduleId === moduleId);
  const ids = new Set();
  for (const s of sessions) (await getSessionRequiredAssessmentIds(s)).forEach((id) => ids.add(id));
  return { sessions, requiredIds: [...ids] };
}

async function isModuleReadyForLearner(courseId, moduleId, classId, learnerId) {
  const { sessions } = await moduleScope(courseId, moduleId);
  const requiredPerSession = await Promise.all(sessions.map((s) => getLearnerRequiredAssessmentIds(s, learnerId, classId)));
  const assessed = sessions.map((s, i) => ({ session: s, requiredIds: requiredPerSession[i] })).filter((x) => x.requiredIds.length > 0);
  if (assessed.length === 0) return false;
  const graded = await getPublishedGraded(learnerId);
  const reports = await Promise.all(assessed.map(({ session }) => ReportModel.findOne({ learnerId, courseId, classId, sessionId: session.id })));
  return assessed.every(({ session, requiredIds }, i) => sessionDone(reports[i], requiredIds, graded.forSession(session.id)));
}

async function buildModuleReportContent(learnerId, courseId, classId, moduleId) {
  const courseModule = await ModuleModel.findById(moduleId);
  const { sessions, requiredIds } = await moduleScope(courseId, moduleId);
  const cls = await ClassModel.findById(classId);
  const content = await buildReportContent(learnerId, requiredIds, cls?.curriculumId, courseId, null, sessions.map((s) => s.id));
  const requiredPerSession = await Promise.all(sessions.map((s) => getLearnerRequiredAssessmentIds(s, learnerId, classId)));
  content.sessionReports = await sessionReportsFor(sessions.filter((s, i) => requiredPerSession[i].length > 0), { learnerId, courseId, classId });
  content.missingWork = await missingWorkFor(learnerId, classId, sessions, content);
  // Names frozen like courseName; and the module's place in the course for "What's next".
  const modules = await ModuleModel.findByCourseId(courseId);
  const index = modules.findIndex((m) => m.id === moduleId);
  content.moduleName = courseModule?.name || null;
  content.moduleNumber = index >= 0 ? index + 1 : null;
  content.moduleCount = modules.length;
  content.nextModuleName = index >= 0 ? modules[index + 1]?.name || null : null;
  return content;
}

// The modules of a course that get their own report and certificate (19 Nov 2026): those with
// something to assess — and only when there are at least two of them. With one, the course's final
// report already covers exactly that work, so a module report would just repeat it.
// Returns { modules, unassessed: [names], coveredByFinal: name | null }.
async function reportableModules(courseId) {
  const all = await ModuleModel.findByCourseId(courseId);
  const assessed = [];
  const unassessed = [];
  for (const m of all) ((await moduleScope(courseId, m.id)).requiredIds.length ? assessed : unassessed).push(m);
  if (assessed.length < 2) return { modules: [], unassessed: unassessed.map((m) => m.name), coveredByFinal: assessed[0]?.name || null };
  return { modules: assessed, unassessed: unassessed.map((m) => m.name), coveredByFinal: null };
}

// The class's educators of one course with a teacher login — who hears that a report is ready.
async function educatorUserIdsFor(classId, courseId) {
  const teacherIds = await db("class_course_teacher_links").where({ classId, courseId }).distinct("teacherId").pluck("teacherId");
  if (!teacherIds.length) return [];
  const teachers = await db("teachers").whereIn("id", teacherIds).select("email", "status");
  const emails = teachers.filter((t) => !["inactive", "removed"].includes(t.status || "active")).map((t) => (t.email || "").toLowerCase()).filter(Boolean);
  if (!emails.length) return [];
  const { rolesOf } = require("../auth/account-roles");
  const users = await db("users").whereIn(db.raw("LOWER(email)"), emails).whereNull("deactivatedAt").select("id", "role", "extraRoles");
  return users.filter((u) => rolesOf(u).includes("teacher")).map((u) => u.id);
}

// "File as not handed in" waits for the class to reach the last session (19 Nov 2026, user: "only
// show at the final session of a module and the final course session"): for a module report, the
// module's last session; for the final report, the course's last session. Before then, missing work
// is mostly work still to come, so filing it isn't offered (or allowed). A session is reached once
// the timetable has placed it on a day up to today (session_occurrences, not cancelled) or it was
// marked taught. A class with no timetable for the course, or whose timetable never gets to that
// session (no date for it within the year ahead), has nothing to wait for — open.
// Returns { course, modules: Map(moduleId -> window) }, each window
// { open, date (reached on, or the next date the timetable gives it), sessionTitle, timetabled }.
const FILING_TTL_MS = 10 * 1000;
const filingCache = new Map();
const utcToday = () => new Date().toISOString().slice(0, 10);
const utcAddDays = (d, n) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
const dayOf = (v) => (v instanceof Date ? v.toISOString().slice(0, 10) : String(v || "").slice(0, 10));
async function filingWindows(classId, courseId) {
  const key = `${classId}:${courseId}`;
  const hit = filingCache.get(key);
  if (hit && Date.now() - hit.at < FILING_TTL_MS) return hit.value;
  const value = await loadFilingWindows(classId, courseId);
  filingCache.set(key, { at: Date.now(), value });
  return value;
}
async function loadFilingWindows(classId, courseId) {
  const sessions = await SessionModel.findByCourseId(courseId);
  const always = { open: true, date: null, sessionTitle: null, timetabled: false };
  if (!sessions.length) return { course: always, modules: new Map() };
  // Required here, not at the top: timetable.service requires this file.
  const TimetableService = require("../timetable/timetable.service");
  const SessionOccurrenceService = require("../timetable/session-occurrence.service");
  const resolveCalendar = (args) => TimetableService.resolveCalendar(args);
  await SessionOccurrenceService.syncClassOccurrences(classId, resolveCalendar).catch(() => null);
  const [occurrences, schedule, slot] = await Promise.all([
    db("session_occurrences").where({ classId, courseId }).select("sessionId", "date", "status", "taughtAt"),
    db("timetable_course_schedules").where({ classId, courseId }).first("id"),
    db("timetable_slots").where({ classId, courseId }).first("id"),
  ]);
  const timetabled = Boolean(occurrences.length || schedule || slot);
  const today = utcToday();
  const reachedOn = new Map();
  for (const o of occurrences) {
    const d = dayOf(o.date);
    if (!o.taughtAt && (o.status === "cancelled" || d > today)) continue;
    if (!reachedOn.has(o.sessionId) || d < reachedOn.get(o.sessionId)) reachedOn.set(o.sessionId, d);
  }
  let upcoming = null;
  const nextDate = async (sessionId) => {
    if (!upcoming) {
      upcoming = new Map();
      try {
        const { events } = await resolveCalendar({ classId, from: utcAddDays(today, 1), to: utcAddDays(today, 365) });
        for (const e of events) if (e.courseId === courseId && !upcoming.has(e.sessionId)) upcoming.set(e.sessionId, e.date);
      } catch { /* no timetable ahead — no date to give */ }
    }
    return upcoming.get(sessionId) || null;
  };
  const windowFor = async (last) => {
    if (!timetabled) return { ...always, sessionTitle: last.title || null };
    if (reachedOn.has(last.id)) return { open: true, date: reachedOn.get(last.id), sessionTitle: last.title || null, timetabled: true };
    // Not reached yet: wait for the date the timetable gives it. With no date ahead (the terms end
    // first, or it's been taken off the timetable) the class will never get there — nothing to wait for.
    const date = await nextDate(last.id);
    return { open: !date, date, sessionTitle: last.title || null, timetabled: true };
  };
  const modules = new Map();
  const lastOfModule = new Map();
  for (const session of sessions) if (session.moduleId) lastOfModule.set(session.moduleId, session); // ordered: the last one wins
  for (const [moduleId, last] of lastOfModule) modules.set(moduleId, await windowFor(last));
  return { course: await windowFor(sessions[sessions.length - 1]), modules };
}

// A module or final report can be made once the class reaches the module's (course's) last session
// — or earlier for a learner who has already done every piece of work (19 Nov 2026, user: missing
// work no longer holds anyone back; the report lists it).
async function reportOpenFor({ classId, courseId, moduleId = null, learnerId }) {
  const windows = await filingWindows(classId, courseId);
  const window = moduleId ? windows.modules.get(moduleId) || windows.course : windows.course;
  if (window.open) return true;
  return moduleId ? isModuleReadyForLearner(courseId, moduleId, classId, learnerId) : isCourseReadyForLearner(courseId, classId, learnerId);
}
async function assertReportOpen(scope) {
  if (await reportOpenFor(scope)) return;
  const windows = await filingWindows(scope.classId, scope.courseId);
  const window = scope.moduleId ? windows.modules.get(scope.moduleId) || windows.course : windows.course;
  const err = new Error(`This report opens when the class reaches the ${scope.moduleId ? "module's" : "course's"} last session${window.date ? ` (${window.date})` : ""}.`);
  err.statusCode = 409;
  throw err;
}

const assertModuleOfCourse = async (moduleId, courseId) => {
  const courseModule = await ModuleModel.findById(moduleId);
  if (!courseModule || courseModule.courseId !== courseId) {
    const err = new Error("Module not found in this course");
    err.statusCode = 404;
    throw err;
  }
  return courseModule;
};

const ReportService = {
  // Same per-learner readiness getReadinessForClassCourse computes, narrowed to a single session
  // — built for the timetable's "what happened in this session" summary (see
  // TimetableService.getSessionSummary), which only ever needs one session's numbers and
  // shouldn't have to walk every other session in the course (and lazily regenerate their
  // reports) just to answer a question about this one.
  async getSessionSummaryForClass(classId, sessionId) {
    const session = await SessionModel.findById(sessionId);
    if (!session) return null;
    const cls = await ClassModel.findById(classId);
    const sessionRequiredIds = await getSessionRequiredAssessmentIds(session);
    const links = await LearnerHubLinkModel.findByClassId(classId);
    const learnerIds = links.filter((l) => l.status === "active").map((l) => l.learnerId);
    const learners = await LearnerModel.findAll({ ids: learnerIds });

    const learnerRows = await Promise.all(learners.map(async (learner) => {
      const requiredIds = await getLearnerRequiredAssessmentIds(session, learner.id, classId);
      // Same lazy generate-on-read trigger getReadinessForClassCourse applies, scoped to just
      // this session — so opening a session's summary is enough to publish its report the moment
      // it becomes ready, without waiting for the course's full Reports page to be opened too.
      await generateSessionReport({ learnerId: learner.id, session, classId, curriculumId: cls?.curriculumId });
      const gradedIds = (await getPublishedGraded(learner.id)).forSession(session.id);
      const gradedCount = requiredIds.filter((id) => gradedIds.has(id)).length;
      const report = await ReportModel.findOne({ learnerId: learner.id, courseId: session.courseId, classId, sessionId });
      return {
        learner,
        requiredCount: requiredIds.length,
        gradedCount,
        ready: requiredIds.length > 0 && gradedCount === requiredIds.length,
        percent: report?.content?.overall?.percent ?? null,
      };
    }));

    const scored = learnerRows.filter((r) => r.percent !== null);
    return {
      requiredCount: sessionRequiredIds.length,
      totalLearners: learnerRows.length,
      fullyGradedCount: learnerRows.filter((r) => r.ready).length,
      averagePercent: scored.length ? Math.round(scored.reduce((sum, r) => sum + r.percent, 0) / scored.length) : null,
      learnerRows,
    };
  },

  // Every actively-enrolled learner in this class, whether their course report is ready to
  // generate (every session-attached assessment graded AND its own report published to the
  // learner), and any report that already exists for them — one call gives the teacher's Reports
  // page everything it needs per learner.
  async getReadinessForClassCourse(classId, courseId) {
    const { attachedCount, requiredIds: requiredAssessmentIds } = await getCourseAssessmentCounts(courseId);
    const sessions = await SessionModel.findByCourseId(courseId);
    const numbering = await sessionNumbering(courseId);
    const links = await LearnerHubLinkModel.findByClassId(classId);
    const learnerIds = links.filter((l) => l.status === "active").map((l) => l.learnerId);
    const learners = await LearnerModel.findAll({ ids: learnerIds });

    // Side effect: auto-generates/publishes any session report that just became ready for any of
    // these learners — this page load is the trigger, there's no separate "Generate" click for
    // session reports (see generateSessionReport's doc comment).
    await ensureSessionReportsGenerated(classId, courseId, learnerIds);

    // One memo for the whole build — classifySessionWork's learner-wide lookups run once each.
    const cache = new Map();
    // Certificates (19 Nov 2026, user — the simple flow): generated by the educator at a module's
    // last session (each module, when the course has two or more) and at the course's last session.
    // Each row carries the learner's certificates; certificateScopes says which there are and when
    // each opens. No module or final combined report is needed.
    const certificateScopes = await CertificateService.certificateScopes(classId, courseId);
    const held = await db("certificates").where({ classId, courseId }).whereIn("kind", ["module", "course"])
      .select("id", "learnerId", "kind", "subjectId", "status", "certificateNumber", "revokeReason", "issuedAt", "verifyToken");
    const certificatesOf = (learnerId) => {
      const mine = held.filter((c) => c.learnerId === learnerId);
      return {
        course: mine.find((c) => c.kind === "course") || null,
        modules: Object.fromEntries(certificateScopes.modules.map((m) => [m.moduleId, mine.find((c) => c.kind === "module" && c.subjectId === m.moduleId) || null])),
      };
    };

    return Promise.all(learners.map(async (learner) => {
      const graded = await getPublishedGraded(learner.id);
      // What's asked of this learner: the course's required assessments less any revoked for them.
      const revokedForThem = new Set([
        ...(await db("assessment_revocations").where({ learnerId: learner.id, classId }).pluck("assessmentId")),
        ...(await notIssuedToThem(learner.id, classId)),
      ]);
      const theirRequiredIds = requiredAssessmentIds.filter((id) => !revokedForThem.has(id));
      // Done in any of the course's sessions that attach it.
      const doneInCourse = new Set(sessions.flatMap((session) => [...graded.forSession(session.id)]));
      const gradedCount = theirRequiredIds.filter((id) => doneInCourse.has(id)).length;
      const sessionRows = await Promise.all(sessions.map(async (session) => {
        const sessionRequiredIds = await getLearnerRequiredAssessmentIds(session, learner.id, classId);
        const sessionGraded = graded.forSession(session.id);
        const sessionGradedCount = sessionRequiredIds.filter((id) => sessionGraded.has(id)).length;
        const sessionReport = await ReportModel.findOne({ learnerId: learner.id, courseId, classId, sessionId: session.id });
        // What still stands in the way (19 Nov 2026), for the Reports page's "File as not handed
        // in": "needs_grading" (work handed in, not marked) or "not_submitted" (never handed in).
        // Worked out only for sessions not already done.
        const finished = sessionRequiredIds.length === 0 || sessionGradedCount === sessionRequiredIds.length || Boolean(sessionReport?.content?.notSubmitted);
        const work = finished ? null : await classifySessionWork(learner.id, session, classId, cache);
        const state = work?.state || null;
        return {
          sessionId: session.id,
          moduleId: session.moduleId || null,
          state,
          openUntil: work?.openUntil || null,
          sessionTitle: session.title || null,
          order: session.order,
          ...placeFields(numbering, session.id),
          requiredCount: sessionRequiredIds.length,
          gradedCount: sessionGradedCount,
          ready: sessionRequiredIds.length > 0 && sessionGradedCount === sessionRequiredIds.length,
          report: sessionReport,
        };
      }));
      // Every session's work done (Year Completion counts this).
      const ready = await isCourseReadyForLearner(courseId, classId, learner.id);
      const report = await ReportModel.findOne({ learnerId: learner.id, courseId, classId });
      return {
        learner,
        requiredCount: theirRequiredIds.length,
        // How many assessments the course's sessions reference at all — larger than requiredCount
        // when some of those assessments have since been deleted. The UI needs both to explain
        // why a course shows fewer (or zero) required assessments than its content implies.
        attachedCount,
        gradedCount,
        sessions: sessionRows,
        ready,
        report,
        certificates: certificatesOf(learner.id),
        certificateScopes,
      };
    }));
  },

  // How far one learner is through a course, counted the way a certificate is earned: of the
  // sessions that have something to assess, how many already have a published report for them.
  // (When every one does, the course is ready for its final report — isCourseReadyForLearner.)
  // Brings one learner's session reports for a course up to date (each publishes itself once
  // its work is marked and released) — normally a side effect of the Reports page's readiness
  // check; the TOT training card (tot.service.js) needs it without that page.
  async refreshSessionReports(learnerId, classId, courseId) {
    await ensureSessionReportsGenerated(classId, courseId, [learnerId]);
  },

  // Straight after an assessment's work is marked, released or revoked
  // (assessment-submission.service.js): the session report(s) it belongs to, for these learners —
  // so a learner sees each mark in their session report the moment it lands. `sessionId` is the
  // issue's session; without one, every session of the course that attaches the assessment.
  async refreshSessionReportsForAssessment({ classId, courseId, sessionId = null, assessmentId, learnerIds = [] }) {
    if (!classId || !courseId || !assessmentId || learnerIds.length === 0) return;
    const sessions = sessionId
      ? [await SessionModel.findById(sessionId)].filter(Boolean)
      : (await SessionModel.findByCourseId(courseId)).filter((s) => getSessionAssessmentIds(s).includes(assessmentId));
    if (sessions.length === 0) return;
    const cls = await ClassModel.findById(classId);
    for (const learnerId of [...new Set(learnerIds)]) {
      for (const session of sessions) {
        await generateSessionReport({ learnerId, session, classId, curriculumId: cls?.curriculumId }).catch((err) => {
          console.error("[reports] session report refresh failed:", err.message);
        });
      }
    }
    // The mark may have finished a module or the course (19 Nov 2026) - in the background.
    setImmediate(() => ReportService.notifyReadyReports(classId, courseId, learnerIds));
  },

  // earlierClassIds (17 Nov 2026): classes the learner was in before on the same curriculum + grade
  // (a move) — a session done there counts here too, so moving doesn't reset their progress.
  // Without them this is exactly the one-class count it always was.
  async getCourseProgressForLearner(courseId, classId, learnerId, earlierClassIds = []) {
    const allSessions = await SessionModel.findByCourseId(courseId);
    const classIds = [classId, ...earlierClassIds.filter((id) => id && id !== classId)];
    const graded = await getPublishedGraded(learnerId);
    const perSession = await Promise.all(allSessions.map(async (session) => {
      const perClass = await Promise.all(classIds.map(async (cid) => {
        const requiredIds = await getLearnerRequiredAssessmentIds(session, learnerId, cid);
        if (!requiredIds.length) return { counts: false, done: false };
        const report = await ReportModel.findOne({ learnerId, courseId, classId: cid, sessionId: session.id });
        return { counts: true, done: sessionDone(report, requiredIds, graded.forSession(session.id)) };
      }));
      return { counts: perClass.some((p) => p.counts), done: perClass.some((p) => p.done) };
    }));
    const counted = perSession.filter((s) => s.counts);
    return { totalSessions: counted.length, doneSessions: counted.filter((s) => s.done).length };
  },

  // Module certificates (19 Nov 2026): how far each learner is through each of these modules of a
  // course, counted the way the course's final report is gated (isCourseReadyForLearner), but over
  // the module's own sessions only — the sessions with something to assess for them, and how many
  // are done (sessionDone). A module with nothing to assess is never finished, like a course.
  // `refresh` first brings their session reports up to date, as the Reports page's readiness does.
  // Returns Map moduleId → Map learnerId → { total, done, ready }.
  async getModulesProgress(classId, courseId, moduleIds, learnerIds, { refresh = false } = {}) {
    if (refresh && learnerIds.length) await ensureSessionReportsGenerated(classId, courseId, learnerIds);
    const sessions = await SessionModel.findByCourseId(courseId);
    const out = new Map(moduleIds.map((id) => [id, new Map()]));
    for (const learnerId of learnerIds) {
      const graded = await getPublishedGraded(learnerId);
      const tally = new Map(moduleIds.map((id) => [id, { total: 0, done: 0 }]));
      for (const session of sessions) {
        const counts = tally.get(session.moduleId);
        if (!counts) continue;
        const requiredIds = await getLearnerRequiredAssessmentIds(session, learnerId, classId);
        if (!requiredIds.length) continue;
        counts.total += 1;
        const report = await ReportModel.findOne({ learnerId, courseId, classId, sessionId: session.id });
        if (sessionDone(report, requiredIds, graded.forSession(session.id))) counts.done += 1;
      }
      for (const [moduleId, { total, done }] of tally) out.get(moduleId).set(learnerId, { total, done, ready: total > 0 && done === total });
    }
    return out;
  },

  // Batched sibling of getReadinessForClassCourse — one call covers every course in a class,
  // replacing the per-(class × course) request fan-out the teacher's Reports page used to issue
  // (a teacher with 5 classes × 10 courses fired 50 parallel requests just to paint the page).
  async getReadinessForClassCourses(classId, courseIds) {
    const result = {};
    await Promise.all(courseIds.map(async (courseId) => {
      result[courseId] = await ReportService.getReadinessForClassCourse(classId, courseId);
    }));
    return result;
  },

  // Every unresolved (learner, session) work item across an entire class — the "what still stands
  // between this class and a complete set of session reports" list, split into the two things a
  // teacher can do about each: grade a submission that exists, or file a not-submitted report for
  // one that doesn't. Read-only; the actual resolution goes through grade() (elsewhere) or
  // markSessionNotSubmitted below. Runs ensureSessionReportsGenerated first so anything that
  // silently became ready doesn't show as outstanding.
  async getUnresolvedSessionWork(classId, courseIds) {
    const cls = await ClassModel.findById(classId);
    const links = await LearnerHubLinkModel.findByClassId(classId);
    const learnerIds = links.filter((l) => l.status === "active").map((l) => l.learnerId);
    const learners = await LearnerModel.findAll({ ids: learnerIds });
    const learnerById = new Map(learners.map((l) => [l.id, l]));

    const needsGrading = [];
    const notSubmitted = [];
    let stillOpen = 0;
    const cache = new Map();

    for (const courseId of courseIds) {
      const sessions = await SessionModel.findByCourseId(courseId);
      await ensureSessionReportsGenerated(classId, courseId, learnerIds);
      for (const session of sessions) {
        for (const learnerId of learnerIds) {
          const { state, missingAssessmentIds, ungraded } = await classifySessionWork(learnerId, session, classId, cache);
          if (state === "open") { stillOpen += 1; continue; }
          if (state !== "needs_grading" && state !== "not_submitted") continue;
          const base = {
            learnerId,
            learner: learnerById.get(learnerId) || null,
            courseId,
            sessionId: session.id,
            sessionTitle: session.title || null,
            sessionOrder: session.order,
            ...placeFields(await sessionNumbering(courseId), session.id),
          };
          if (state === "needs_grading") needsGrading.push({ ...base, assessmentIds: ungraded });
          else notSubmitted.push({ ...base, assessmentIds: missingAssessmentIds });
        }
      }
    }
    // stillOpen: (learner, session) pairs whose missing work isn't due yet (19 Nov 2026) — can't be filed.
    return { classId, curriculumId: cls?.curriculumId || null, needsGrading, notSubmitted, stillOpen };
  },

  // Every session of a course — or of one module (moduleId) — that this learner never handed work
  // in for, filed "not submitted" in one go (19 Nov 2026, the teacher Reports page's "File as not
  // handed in"). That's what lets a learner who didn't submit still finish: the course (or module)
  // becomes ready, its report can go out, and with it the certificate. Sessions with work handed
  // in but not yet marked are left alone — they still need marking. Returns { filed, needsGrading }.
  async fileNotSubmittedForLearner({ classId, courseId, learnerId, moduleId = null, actorId }) {
    if (moduleId) await assertModuleOfCourse(moduleId, courseId);
    // Only from the module's (or course's) last session — see filingWindows.
    const windows = await filingWindows(classId, courseId);
    const window = moduleId ? windows.modules.get(moduleId) || windows.course : windows.course;
    if (!window.open) {
      const err = new Error(`Missing work can be filed once the class reaches the ${moduleId ? "module's" : "course's"} last session${window.date ? ` (${window.date})` : ""}.`);
      err.statusCode = 409;
      throw err;
    }
    const sessions = (await SessionModel.findByCourseId(courseId)).filter((s) => !moduleId || s.moduleId === moduleId);
    let filed = 0;
    let needsGrading = 0;
    let stillOpen = 0;
    const cache = new Map();
    for (const session of sessions) {
      const { state } = await classifySessionWork(learnerId, session, classId, cache);
      if (state === "needs_grading") needsGrading += 1;
      if (state === "open") stillOpen += 1;
      if (state !== "not_submitted") continue;
      await ReportService.markSessionNotSubmitted({ classId, courseId, sessionId: session.id, learnerId, actorId, notify: false });
      filed += 1;
    }
    return { filed, needsGrading, stillOpen };
  },

  // Whole class at once (19 Nov 2026), for a course's final report or one module's:
  //   generate - a draft for every learner who is ready and has no report yet;
  //   publish  - every draft (each issues its certificate, as one by one).
  // Returns { done, skipped } - skipped: learners not ready yet (generate).
  async bulkReports({ action, classId, courseId, moduleId = null, actorId }) {
    if (moduleId) await assertModuleOfCourse(moduleId, courseId);
    const learnerIds = (await LearnerHubLinkModel.findByClassId(classId)).filter((l) => l.status === "active").map((l) => l.learnerId);
    let done = 0;
    let skipped = 0;
    if (action === "generate") {
      for (const learnerId of learnerIds) {
        const existing = await ReportModel.findOne({ learnerId, courseId, classId, moduleId });
        if (existing) continue;
        if (!(await reportOpenFor({ classId, courseId, moduleId, learnerId }))) { skipped += 1; continue; }
        await ReportService.generateReport({ learnerId, courseId, classId, moduleId, generatedBy: actorId });
        done += 1;
      }
    } else if (action === "issue") {
      // Every learner whose report is published and who has no standing certificate for it.
      const published = (await ReportModel.findAll({ classId, courseId, status: "published" }))
        .filter((r) => learnerIds.includes(r.learnerId) && (moduleId ? r.moduleId === moduleId && !r.sessionId : ReportModel.isFinalCourseReport(r)));
      for (const r of published) {
        const held = await CertificateService.findForScope({ learnerId: r.learnerId, courseId, classId, moduleId });
        if (held?.status === "issued") continue;
        await CertificateService.issueForReportByStaff(r.id, actorId);
        done += 1;
      }
    } else {
      const drafts = (await ReportModel.findAll({ classId, courseId, status: "draft" }))
        .filter((r) => learnerIds.includes(r.learnerId) && (moduleId ? r.moduleId === moduleId && !r.sessionId : ReportModel.isFinalCourseReport(r)));
      for (const r of drafts) { await ReportService.publishReport(r.id, actorId); done += 1; }
    }
    return { done, skipped };
  },

  // Used to tell the class's educators (bell) that a learner had finished a course or module and its
  // report could be generated for the certificate. Off since 19 Nov 2026: certificates are generated
  // at the last session without any report, so there's nothing to prompt. Kept for its callers.
  async notifyReadyReports() {},

  // Files a "not submitted" session report for one (learner, session) pair — the resolution for a
  // learner who simply never submitted a required assessment. Refuses (409) if the learner
  // actually HAS a submission that just hasn't been graded: that has to be graded, not written
  // off. The report is published immediately (same as an ordinary session report — no draft
  // stage) and carries content.notSubmitted so the report renderer shows "Not submitted" rather
  // than a zero score, and so classifySessionWork treats the pair as resolved on the next pass.
  // Idempotent: re-running for a pair that already has a not-submitted report returns it unchanged.
  async markSessionNotSubmitted({ classId, courseId, sessionId, learnerId, actorId, notify = true }) {
    const session = await SessionModel.findById(sessionId);
    if (!session) notFound("Session not found");
    if (session.courseId !== courseId) {
      const err = new Error("Session does not belong to that course");
      err.statusCode = 400;
      throw err;
    }

    const { state, missingAssessmentIds } = await classifySessionWork(learnerId, session, classId);
    if (state === "resolved_no_submit") {
      return ReportModel.findOne({ learnerId, courseId, classId, sessionId });
    }
    if (state === "ready") {
      const err = new Error("This learner's work for this session is already graded — no not-submitted report is needed.");
      err.statusCode = 409;
      throw err;
    }
    if (state === "needs_grading") {
      const err = new Error("This learner has a submission awaiting grading — grade it instead of marking it not submitted.");
      err.statusCode = 409;
      throw err;
    }
    if (state === "open") {
      const err = new Error("This work isn't due yet — the learner can still hand it in. File it as not submitted once the due date has passed.");
      err.statusCode = 409;
      throw err;
    }
    if (state === "nothing_required") {
      const err = new Error("This session has no assessments to report on.");
      err.statusCode = 409;
      throw err;
    }

    const missingAssessments = await Promise.all(
      missingAssessmentIds.map(async (id) => {
        const a = await AssessmentModel.findById(id);
        return { assessmentId: id, name: a?.name || "Untitled assessment", type: a?.type || null };
      })
    );

    // A not-submitted report still carries the same shell shape an ordinary session report has
    // (empty assessments, zeroed overall) so every existing reader — the learner-portal list,
    // buildCourseReportContent's sessionReports summary — keeps working without a special case.
    // 19 Nov 2026: when some of the session's work WAS marked, the report keeps it (score, skills,
    // feedback) and lists only the missing pieces as not handed in — before, filing wiped it.
    const requiredIds = await getLearnerRequiredAssessmentIds(session, learnerId, classId);
    const markedIds = (await getPublishedGraded(learnerId)).forSession(session.id);
    const anyMarked = requiredIds.some((id) => markedIds.has(id));
    const cls = await ClassModel.findById(classId);
    const content = anyMarked
      ? {
        ...(await buildReportContent(learnerId, requiredIds, cls?.curriculumId, courseId, session.id)),
        ...(await sessionPlace(session)),
        notSubmitted: true,
        notSubmittedAssessments: missingAssessments,
      }
      : {
        notSubmitted: true,
        notSubmittedAssessments: missingAssessments,
        assessments: [],
        overall: { totalScore: 0, maxScore: 0, percent: 0 },
        indicatorBreakdown: [],
        competencyScores: [],
        courseName: (await CourseModel.findById(courseId))?.name || null,
        sessionName: session.title || null,
      };

    const existing = await ReportModel.findOne({ learnerId, courseId, classId, sessionId });
    const now = new Date();
    // Filing can finish a module or the course: tell the educators (not from the bulk filing on the
    // Reports page — they're looking at it).
    const tellIfReady = () => { if (notify) setImmediate(() => ReportService.notifyReadyReports(classId, courseId, [learnerId])); };
    if (existing) {
      const updated = await ReportModel.update(existing.id, {
        content,
        status: "published",
        publishedAt: existing.publishedAt || now,
        publishedBy: existing.publishedBy || actorId || "system",
      });
      tellIfReady();
      return updated;
    }
    const created = await ReportModel.create({
      learnerId,
      courseId,
      classId,
      sessionId,
      hubId: cls?.schoolId || null,
      status: "published",
      generatedAt: now,
      generatedBy: actorId || "system",
      publishedAt: now,
      publishedBy: actorId || "system",
      remarks: "",
      content,
    });
    // ReportModel.create hands back the pre-insert row with `content` still JSON-stringified;
    // re-read so callers get the same parsed shape every other read path returns. Deliberately
    // NOT notifying the learner here (unlike generateSessionReport) — a push announcing "new
    // report — 0%" for work that was never submitted reads as a punishment, not information; it
    // still appears in their reports list, which is the right level of visibility for this.
    tellIfReady();
    return (await ReportModel.findById(created.id)) || created;
  },

  // Idempotent: re-generating an already-existing report updates its draft snapshot instead of
  // creating a duplicate (findOne on learnerId+courseId is the natural key). Throws 409 if the
  // learner isn't actually ready yet, so the client can't skip the readiness check.
  async generateReport({ learnerId, courseId, classId, moduleId = null, generatedBy }) {
    if (moduleId) return ReportService.generateModuleReport({ learnerId, courseId, classId, moduleId, generatedBy });
    const requiredAssessmentIds = await getCourseRequiredAssessmentIds(courseId);
    if (requiredAssessmentIds.length === 0) {
      const err = new Error("This course has no attached assessments to report on");
      err.statusCode = 409;
      throw err;
    }
    await assertReportOpen({ classId, courseId, moduleId: null, learnerId });

    const content = await buildCourseReportContent(learnerId, courseId, classId);

    const existing = await ReportModel.findOne({ learnerId, courseId, classId });
    // A published report is locked (19 Nov 2026) — withdraw it to draft to rebuild it.
    if (existing?.status === "published") return existing;
    if (existing) return ReportModel.update(existing.id, { content });

    const cls = await ClassModel.findById(classId);
    return ReportModel.create({
      learnerId, courseId, classId,
      hubId: cls?.schoolId || null,
      status: "draft",
      generatedAt: new Date(),
      generatedBy,
      publishedAt: null,
      publishedBy: null,
      remarks: "",
      content,
    });
  },

  // Which of a course's modules get their own report and certificate — see reportableModules.
  reportableModules(courseId) {
    return reportableModules(courseId);
  },

  // A module's combined report (19 Nov 2026), drafted like the course's: once every assessed
  // session of the module is done for this learner. Generating again refreshes the draft.
  async generateModuleReport({ learnerId, courseId, classId, moduleId, generatedBy }) {
    await assertModuleOfCourse(moduleId, courseId);
    const { modules: reportable } = await reportableModules(courseId);
    if (!reportable.some((m) => m.id === moduleId)) {
      const err = new Error("This module has no report of its own — it has nothing to assess, or it's the course's only module with assessments (the final course report covers it).");
      err.statusCode = 409;
      throw err;
    }
    const { requiredIds } = await moduleScope(courseId, moduleId);
    if (requiredIds.length === 0) {
      const err = new Error("This module has no attached assessments to report on");
      err.statusCode = 409;
      throw err;
    }
    await assertReportOpen({ classId, courseId, moduleId, learnerId });
    const content = await buildModuleReportContent(learnerId, courseId, classId, moduleId);
    const existing = await ReportModel.findOne({ learnerId, courseId, classId, moduleId });
    if (existing) return existing.status === "published" ? existing : ReportModel.update(existing.id, { content });
    const cls = await ClassModel.findById(classId);
    return ReportModel.create({
      learnerId, courseId, classId, moduleId,
      hubId: cls?.schoolId || null,
      status: "draft",
      generatedAt: new Date(),
      generatedBy,
      publishedAt: null,
      publishedBy: null,
      remarks: "",
      content,
    });
  },

  // Editable only while still a draft — once published, a report is the learner/guardian's
  // permanent record of what they were told; changing it after the fact without a trace would
  // undermine that. A teacher who genuinely needs to correct it withdraws to draft first (see
  // unpublishReport), which re-opens editing and re-snapshots content on the next publish.
  async updateRemarks(id, { remarks, homeNote } = {}) {
    const report = await ReportModel.findById(id);
    if (!report) notFound("Report not found");
    if (report.status === "published") {
      const err = new Error("This report is published and locked — withdraw it to draft first to change the remarks");
      err.statusCode = 409;
      throw err;
    }
    const patch = {};
    if (remarks !== undefined) patch.remarks = remarks;
    if (homeNote !== undefined) patch.homeNote = homeNote.trim() || null;
    return Object.keys(patch).length ? ReportModel.update(id, patch) : report;
  },

  // One-time draft→published transition — re-snapshots content fresh in case more grading
  // landed since the draft was generated, so what a guardian first sees is accurate. A repeat
  // call is a no-op (returns the already-published report unchanged) rather than re-snapshotting
  // scores out from under someone who's already read them.
  async publishReport(id, publishedBy) {
    const report = await ReportModel.findById(id);
    if (!report) notFound("Report not found");
    if (report.status === "published") return report;

    // A module report (19 Nov 2026): rebuilt over the module. No end-of-course mentor prompt — the
    // course isn't over. Publishing no longer issues a certificate (19 Nov 2026, user): once the
    // report is out, the educator issues it — Issue certificate (CertificateService.issueForReportByStaff).
    if (ReportModel.isModuleReport(report)) {
      const content = await buildModuleReportContent(report.learnerId, report.courseId, report.classId, report.moduleId);
      return ReportModel.update(id, { content, status: "published", publishedAt: new Date(), publishedBy });
    }

    const content = await buildCourseReportContent(report.learnerId, report.courseId, report.classId);
    const published = await ReportModel.update(id, {
      content,
      status: "published",
      publishedAt: new Date(),
      publishedBy,
    });
    // The course certificate is issued by the educator once this is out (Issue certificate) — not
    // automatically (19 Nov 2026, user).
    // And the end-of-course "how did the mentor do?" prompt to the family (modules/mentor-reviews/),
    // in the background — never failing the publish.
    setImmediate(() => require("../mentor-reviews/mentor-review.service").afterCourseReport(published)
      .catch((err) => console.error("[mentor-reviews] end-of-course prompt failed:", err.message)));
    return published;
  },

  // Withdraws an already-published report back to draft, hiding it from the learner/guardian
  // again. Deliberately a status reversal rather than a delete: a report published in error (wrong
  // learner, scores that turned out to need re-grading) needs to be retractable, but destroying
  // the record would also lose the remarks and the generation history. Re-publishing afterwards
  // re-snapshots content, so any grading corrected in between is picked up. No-op if it's already
  // a draft, mirroring publishReport's own idempotency.
  async unpublishReport(id) {
    const report = await ReportModel.findById(id);
    if (!report) notFound("Report not found");
    if (report.status !== "published") return report;
    // The certificate issued on it is revoked with it; issuing again after re-publishing brings back
    // the same one (same number).
    await CertificateService.revokeForReportSafely(report);
    return ReportModel.update(id, { status: "draft", publishedAt: null, publishedBy: null });
  },

  async getById(id) {
    return ReportModel.findById(id);
  },

  // When "File as not handed in" opens for a class's course and each of its modules (filingWindows).
  async filingWindows(classId, courseId) {
    return filingWindows(classId, courseId);
  },

  // For a final course report: the course's module reports this learner hasn't had published yet
  // (names, in module order). Each module certificate comes only from its own module report, so the
  // educator is told before publishing the final report that these are still to do. [] otherwise.
  async moduleReportsOutstanding(report) {
    if (!report || !ReportModel.isFinalCourseReport(report)) return [];
    const { modules } = await reportableModules(report.courseId);
    if (!modules.length) return [];
    const published = new Set((await ReportModel.findAll({ learnerId: report.learnerId, classId: report.classId, courseId: report.courseId, status: "published" }))
      .filter((r) => r.moduleId).map((r) => r.moduleId));
    return modules.filter((m) => !published.has(m.id)).map((m) => m.name);
  },

  async listForClassCourse({ classId, courseId }) {
    return ReportModel.findAll({ classId, courseId });
  },

  // Optional hubId scopes to the hub the learner-portal switcher is currently on — a learner
  // enrolled at several hubs shouldn't see another hub's reports mixed into this one's list, the
  // same scoping every other portal surface (courses, competencies, assessments) already applies.
  // Omitted, returns every published report across all hubs.
  async listForLearner(learnerId, hubId = null) {
    const reports = await ReportModel.findAll({ learnerId, status: "published" });
    return this.withAuthor(hubId ? reports.filter((r) => r.hubId === hubId) : reports);
  },

  // The teachers behind a report's comments, looked up as it's served so "From the teacher" shows
  // their face and name as they are today (10 Nov 2026) — reports saved before then never stored a
  // photo, and a teacher may change theirs. The report's own remarks come from whoever published
  // it (publishedBy: a teacher id or a user id; "system" for automatic ones — no name); each
  // marked piece's comment from whoever marked it (the learner's submission on that issue).
  async withAuthor(reports) {
    const list = (Array.isArray(reports) ? reports : [reports]).filter(Boolean);
    const cache = new Map();
    const who = async (id) => {
      if (!id || id === "system") return { name: null, photo: null };
      if (!cache.has(id)) cache.set(id, await AssessmentSubmissionService.resolveGrader(id).catch(() => ({ name: null, photo: null })));
      return cache.get(id);
    };
    // Matched on the issue the learner answered; older reports have no issueId, so then on the
    // assessment (their latest marked attempt).
    const withFeedback = list.flatMap((r) => (r.content?.assessments || []).filter((a) => a?.assessmentId && String(a.feedback || "").trim()).map((a) => ({ r, a })));
    const graders = new Map();
    if (withFeedback.length) {
      const rows = await db("assessment_submissions")
        .whereIn("assessmentId", [...new Set(withFeedback.map((x) => x.a.assessmentId))])
        .whereIn("learnerId", [...new Set(withFeedback.map((x) => x.r.learnerId))])
        .whereNotNull("gradedBy")
        .orderBy("gradedAt", "asc")
        .select("issueId", "assessmentId", "learnerId", "gradedBy");
      for (const row of rows) {
        graders.set(`${row.issueId}:${row.learnerId}`, row.gradedBy);
        graders.set(`a:${row.assessmentId}:${row.learnerId}`, row.gradedBy);
      }
    }
    for (const { r, a } of withFeedback) {
      const g = await who(graders.get(`${a.issueId}:${r.learnerId}`) || graders.get(`a:${a.assessmentId}:${r.learnerId}`));
      if (g.name) a.gradedByName = g.name;
      a.gradedByPhoto = g.photo || null;
    }
    for (const r of list) {
      const g = await who(r.publishedBy);
      r.publishedByName = g.name;
      r.publishedByPhoto = g.photo;
    }
    return reports;
  },

  // Academic-performance rollup for a hub's Reports page — deliberately built from data that
  // already exists rather than re-deriving scores/competencies from scratch: a published final
  // report's content.overall.percent and content.competencyScores are the same snapshot the
  // learner/guardian sees, so the hub's aggregate view can't disagree with what a family reads on
  // an individual report. Attendance has no such snapshot anywhere, so that piece alone is
  // computed here from raw records.
  async getHubAnalytics(hubId, { days = 30, gender = null } = {}) {
    const classes = await ClassModel.findAll({ schoolId: hubId });
    const classIds = classes.map((c) => c.id);

    let links = await LearnerHubLinkModel.findByHubId(hubId);
    let allReports = await ReportModel.findAll({ hubId });
    const dateFrom = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
    let attendanceByClass = await Promise.all(
      classIds.map((id) => AttendanceModel.findAll({ classId: id, dateFrom }))
    );

    // Optional gender filter — every KPI/chart/table below is derived from these three raw sets
    // (links, reports, attendance), so filtering them here by learner gender is enough to scope
    // the entire response without touching any of the actual analytics math further down.
    if (gender) {
      const learnerIds = new Set([
        ...links.map((l) => l.learnerId),
        ...allReports.map((r) => r.learnerId),
        ...attendanceByClass.flat().map((a) => a.learnerId),
      ]);
      const learners = await LearnerModel.findAll({ ids: [...learnerIds] });
      const matching = new Set(learners.filter((l) => l.gender === gender).map((l) => l.id));
      links = links.filter((l) => matching.has(l.learnerId));
      allReports = allReports.filter((r) => matching.has(r.learnerId));
      attendanceByClass = attendanceByClass.map((rows) => rows.filter((a) => matching.has(a.learnerId)));
    }

    const activeLinks = links.filter((l) => l.status === "active");
    const activeLinksByClass = {};
    activeLinks.forEach((l) => {
      if (!l.classId) return;
      activeLinksByClass[l.classId] = (activeLinksByClass[l.classId] || 0) + 1;
    });

    const finalReports = allReports.filter(ReportModel.isFinalCourseReport);
    const publishedFinals = finalReports.filter((r) => r.status === "published");
    const draftFinals = finalReports.filter((r) => r.status === "draft");
    const scored = publishedFinals.filter((r) => r.content?.overall?.percent != null);
    const { expected } = await getExpectedCourseCompletions(classes, activeLinks);
    const completionStats = buildCompletionStats(
      publishedFinals.filter((r) => activeLinks.some((l) => l.learnerId === r.learnerId && l.classId === r.classId)),
      expected
    );

    const averageScore = scored.length
      ? Math.round(scored.reduce((sum, r) => sum + r.content.overall.percent, 0) / scored.length)
      : null;

    const courseSums = {}, courseCounts = {};
    scored.forEach((r) => {
      courseSums[r.courseId] = (courseSums[r.courseId] || 0) + r.content.overall.percent;
      courseCounts[r.courseId] = (courseCounts[r.courseId] || 0) + 1;
    });
    const courseIds = Object.keys(courseSums);
    const courses = await Promise.all(courseIds.map((id) => CourseModel.findById(id)));
    const scoreByCourse = courseIds.map((id, i) => ({
      courseId: id,
      courseName: courses[i]?.name || "Untitled course",
      averagePercent: Math.round(courseSums[id] / courseCounts[id]),
    }));

    const compSums = {}, compCounts = {}, compNames = {};
    scored.forEach((r) => (r.content.competencyScores || []).forEach((cs) => {
      compSums[cs.competencyId] = (compSums[cs.competencyId] || 0) + cs.score;
      compCounts[cs.competencyId] = (compCounts[cs.competencyId] || 0) + 1;
      compNames[cs.competencyId] = cs.name;
    }));
    const competencyScores = Object.keys(compSums).map((id) => ({
      competencyId: id,
      name: compNames[id],
      averageScore: Math.round(compSums[id] / compCounts[id]),
    }));

    const allAttendance = attendanceByClass.flat();
    const attendanceRate = allAttendance.length
      ? Math.round((allAttendance.filter((a) => a.status === "present").length / allAttendance.length) * 100)
      : null;

    // Bucketed by each record's Monday so the trend reads as consistent weekly steps rather
    // than one point per school day.
    const weekBuckets = {};
    allAttendance.forEach((a) => {
      const d = new Date(a.date);
      const monday = new Date(d);
      monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
      const key = monday.toISOString().slice(0, 10);
      if (!weekBuckets[key]) weekBuckets[key] = { present: 0, total: 0 };
      weekBuckets[key].total += 1;
      if (a.status === "present") weekBuckets[key].present += 1;
    });
    const attendanceTrend = Object.keys(weekBuckets).sort().map((weekStart) => ({
      weekStart,
      rate: Math.round((weekBuckets[weekStart].present / weekBuckets[weekStart].total) * 100),
    }));

    const classBreakdown = classes.map((cls, i) => {
      const classAttendance = attendanceByClass[i] || [];
      const classScored = scored.filter((r) => r.classId === cls.id);
      return {
        classId: cls.id,
        name: cls.gradeName || cls.name || cls.streamName,
        learnerCount: activeLinksByClass[cls.id] || 0,
        averageScore: classScored.length
          ? Math.round(classScored.reduce((sum, r) => sum + r.content.overall.percent, 0) / classScored.length)
          : null,
        attendanceRate: classAttendance.length
          ? Math.round((classAttendance.filter((a) => a.status === "present").length / classAttendance.length) * 100)
          : null,
        publishedCount: publishedFinals.filter((r) => r.classId === cls.id).length,
        draftCount: draftFinals.filter((r) => r.classId === cls.id).length,
      };
    });

    return {
      classCount: classes.length,
      activeLearnerCount: activeLinks.length,
      reportStats: { published: publishedFinals.length, draft: draftFinals.length },
      completionStats,
      averageScore,
      scoreByCourse,
      competencyScores,
      attendanceRate,
      attendanceTrend,
      classBreakdown,
    };
  },

  // The platform-admin sibling of getHubAnalytics above — same computation, scoped across every
  // hub THIS ADMIN OWNS (each admin is its own tenant — see the ownerAdminId migrations), plus a
  // hub-by-hub breakdown (the admin-only view a single school's own Reports page can never show:
  // which hubs are thriving vs falling behind). Deliberately reads the raw Report/Attendance rows
  // directly rather than composing from N calls to getHubAnalytics — that would mean re-averaging
  // already-rounded per-hub numbers, compounding rounding error and losing the correct
  // per-report/per-record weighting the single-hub version gets for free.
  async getPlatformAnalytics({ days = 30, ownerAdminId } = {}) {
    const hubs = await LearningHubModel.findAll({ ownerAdminId });
    const hubIds = new Set(hubs.map((h) => h.id));
    const classes = (await ClassModel.findAll()).filter((c) => hubIds.has(c.schoolId));
    const classIds = new Set(classes.map((c) => c.id));
    const hubIdByClassId = {};
    classes.forEach((c) => { hubIdByClassId[c.id] = c.schoolId; });

    const links = (await LearnerHubLinkModel.findAll()).filter((l) => hubIds.has(l.hubId));
    const activeLinks = links.filter((l) => l.status === "active");
    const activeLearnerCountByHub = {};
    activeLinks.forEach((l) => {
      activeLearnerCountByHub[l.hubId] = (activeLearnerCountByHub[l.hubId] || 0) + 1;
    });

    const allReports = (await ReportModel.findAll({})).filter((r) => hubIds.has(r.hubId));
    const finalReports = allReports.filter(ReportModel.isFinalCourseReport);
    const publishedFinals = finalReports.filter((r) => r.status === "published");
    const draftFinals = finalReports.filter((r) => r.status === "draft");
    const scored = publishedFinals.filter((r) => r.content?.overall?.percent != null);
    const { expected, expectedByClass } = await getExpectedCourseCompletions(classes, activeLinks);
    const activeEnrollmentKeys = new Set(activeLinks.map((link) => `${link.learnerId}:${link.classId}`));
    const activePublishedFinals = publishedFinals.filter((report) => activeEnrollmentKeys.has(`${report.learnerId}:${report.classId}`));
    const completionStats = buildCompletionStats(activePublishedFinals, expected);

    const averageScore = scored.length
      ? Math.round(scored.reduce((sum, r) => sum + r.content.overall.percent, 0) / scored.length)
      : null;

    const courseSums = {}, courseCounts = {};
    scored.forEach((r) => {
      courseSums[r.courseId] = (courseSums[r.courseId] || 0) + r.content.overall.percent;
      courseCounts[r.courseId] = (courseCounts[r.courseId] || 0) + 1;
    });
    const courseIds = Object.keys(courseSums);
    const courses = await Promise.all(courseIds.map((id) => CourseModel.findById(id)));
    const scoreByCourse = courseIds.map((id, i) => ({
      courseId: id,
      courseName: courses[i]?.name || "Untitled course",
      averagePercent: Math.round(courseSums[id] / courseCounts[id]),
    }));

    const compSums = {}, compCounts = {}, compNames = {};
    scored.forEach((r) => (r.content.competencyScores || []).forEach((cs) => {
      compSums[cs.competencyId] = (compSums[cs.competencyId] || 0) + cs.score;
      compCounts[cs.competencyId] = (compCounts[cs.competencyId] || 0) + 1;
      compNames[cs.competencyId] = cs.name;
    }));
    const competencyScores = Object.keys(compSums).map((id) => ({
      competencyId: id,
      name: compNames[id],
      averageScore: Math.round(compSums[id] / compCounts[id]),
    }));

    const dateFrom = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
    // One query across every class platform-wide, then filtered down to this admin's own classes
    // in JS — instead of getHubAnalytics's per-class loop (that loop exists there because
    // AttendanceModel.findAll only takes one classId at a time; fetching each of this admin's
    // classes individually here would mean one query per class instead of one query total).
    const allAttendance = (await AttendanceModel.findAll({ dateFrom })).filter((a) => classIds.has(a.classId));
    const attendanceRate = allAttendance.length
      ? Math.round((allAttendance.filter((a) => a.status === "present").length / allAttendance.length) * 100)
      : null;

    const weekBuckets = {};
    const attendanceByHub = {};
    allAttendance.forEach((a) => {
      const d = new Date(a.date);
      const monday = new Date(d);
      monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
      const key = monday.toISOString().slice(0, 10);
      if (!weekBuckets[key]) weekBuckets[key] = { present: 0, total: 0 };
      weekBuckets[key].total += 1;
      if (a.status === "present") weekBuckets[key].present += 1;

      const hubId = hubIdByClassId[a.classId];
      if (!hubId) return;
      if (!attendanceByHub[hubId]) attendanceByHub[hubId] = { present: 0, total: 0 };
      attendanceByHub[hubId].total += 1;
      if (a.status === "present") attendanceByHub[hubId].present += 1;
    });
    const attendanceTrend = Object.keys(weekBuckets).sort().map((weekStart) => ({
      weekStart,
      rate: Math.round((weekBuckets[weekStart].present / weekBuckets[weekStart].total) * 100),
    }));

    const classCountByHub = {};
    classes.forEach((c) => { classCountByHub[c.schoolId] = (classCountByHub[c.schoolId] || 0) + 1; });

    const hubBreakdown = hubs.map((hub) => {
      const hubScored = scored.filter((r) => r.hubId === hub.id);
      const hubAttendance = attendanceByHub[hub.id];
      const hubExpected = classes
        .filter((cls) => cls.schoolId === hub.id)
        .reduce((sum, cls) => sum + (expectedByClass[cls.id] || 0), 0);
      const hubCompleted = activePublishedFinals.filter((r) => r.hubId === hub.id).length;
      return {
        hubId: hub.id,
        name: hub.name,
        classCount: classCountByHub[hub.id] || 0,
        learnerCount: activeLearnerCountByHub[hub.id] || 0,
        averageScore: hubScored.length
          ? Math.round(hubScored.reduce((sum, r) => sum + r.content.overall.percent, 0) / hubScored.length)
          : null,
        attendanceRate: hubAttendance ? Math.round((hubAttendance.present / hubAttendance.total) * 100) : null,
        completionRate: hubExpected > 0 ? Math.round((hubCompleted / hubExpected) * 100) : null,
        publishedCount: publishedFinals.filter((r) => r.hubId === hub.id).length,
        draftCount: draftFinals.filter((r) => r.hubId === hub.id).length,
      };
    });

    return {
      hubCount: hubs.length,
      classCount: classes.length,
      activeLearnerCount: activeLinks.length,
      reportStats: { published: publishedFinals.length, draft: draftFinals.length },
      completionStats,
      averageScore,
      scoreByCourse,
      competencyScores,
      attendanceRate,
      attendanceTrend,
      hubBreakdown,
    };
  },
};

module.exports = ReportService;
