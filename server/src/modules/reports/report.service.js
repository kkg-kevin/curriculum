const ReportModel = require("./report.model");
const SessionModel = require("../courses/session.model");
const { getSessionAssessmentIds } = require("../courses/sessionAssessment.utils");
const ClassModel = require("../classes/class.model");
const CourseModel = require("../courses/course.model");
const LearnerModel = require("../learners/learner.model");
const LearnerHubLinkModel = require("../learners/learner-hub-link.model");
const AssessmentModel = require("../assessments/assessment.model");
const AssessmentSubmissionModel = require("../assessments/submissions/assessment-submission.model");
const AssessmentSubmissionService = require("../assessments/submissions/assessment-submission.service");
const CompetencyService = require("../curriculum/competency-framework/competency.service");

function notFound(message) {
  const err = new Error(message);
  err.statusCode = 404;
  throw err;
}

// Every assessment a learner needs graded for a course to be report-eligible — a course's
// content is a list of Sessions, each of which may carry its own attached assessment(s) (see
// sessionAssessment.utils.js), so this is the union of every session's attachments. Filtered to
// assessments that still actually exist — a session can keep referencing an assessment's id after
// that assessment was deleted (attachment records aren't cleaned up on delete), and treating a
// dead reference as "required" would make the course permanently unable to reach "ready" for any
// learner, since a deleted assessment can never be graded.
function getCourseRequiredAssessmentIds(courseId) {
  return getCourseAssessmentCounts(courseId).requiredIds;
}

// Both the attached ids and the subset that still resolves to a real assessment. Callers that
// only need the requirement use getCourseRequiredAssessmentIds above; the readiness view also
// wants `attachedCount` so it can explain a course whose requirement silently shrank (or hit
// zero) because assessments were deleted out from under its sessions.
function getCourseAssessmentCounts(courseId) {
  const sessions = SessionModel.findByCourseId(courseId);
  const ids = new Set();
  sessions.forEach((session) => getSessionAssessmentIds(session).forEach((id) => ids.add(id)));
  const attachedIds = [...ids];
  return {
    attachedIds,
    attachedCount: attachedIds.length,
    requiredIds: attachedIds.filter((id) => !!AssessmentModel.findById(id)),
  };
}

// Same "still exists" filter as getCourseAssessmentCounts, scoped to one session's own attached
// assessments — the unit a session report is built from.
function getSessionRequiredAssessmentIds(session) {
  return getSessionAssessmentIds(session).filter((id) => !!AssessmentModel.findById(id));
}

// A submission only counts toward a course report once its own report has been published to the
// learner (see assessment-submission.service.js's publishReport) — otherwise a course report
// could reveal a score the learner hasn't seen released on that assessment's own page yet.
function getPublishedGradedAssessmentIds(learnerId) {
  return new Set(
    AssessmentSubmissionModel.findAll({ learnerId, status: "graded" })
      .filter((s) => s.reportPublished)
      .map((s) => s.assessmentId)
  );
}

function buildReportContent(learnerId, requiredAssessmentIds, curriculumId, courseId, sessionId = null) {
  const publishedIds = getPublishedGradedAssessmentIds(learnerId);
  const submissions = AssessmentSubmissionModel.findAll({ learnerId, status: "graded" })
    .filter((s) => requiredAssessmentIds.includes(s.assessmentId) && publishedIds.has(s.assessmentId));

  const assessments = submissions.map((s) => {
    const assessment = AssessmentModel.findById(s.assessmentId);
    const maxScore = s.maxScore || 0;
    const totalScore = s.totalScore || 0;
    return {
      assessmentId: s.assessmentId,
      name: assessment?.name || "Untitled assessment",
      type: assessment?.type || null,
      totalScore,
      maxScore,
      percent: maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0,
      gradedAt: s.gradedAt,
      // The teacher's written comment from grading (GradingPanel.jsx) — never surfaced anywhere
      // in the report before; without it a report showed only a number, not what the teacher
      // actually said about the work.
      feedback: s.overallFeedback || "",
    };
  });

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

  const indicatorBreakdown = AssessmentSubmissionService.getLearnerIndicatorProgressForAssessments(
    learnerId,
    requiredAssessmentIds
  );

  // The curriculum's own score/level/band per competency — a different number from the flat
  // indicatorBreakdown above, same pair shown together on the graded assessment view and the
  // Profile Competencies tab. Scoped to THIS course's assessments, matching indicatorBreakdown:
  // a course report shouldn't fold in competency standing the learner earned on other courses.
  const competencyScores = curriculumId
    ? CompetencyService.getLearnerCompetencyScoresForAssessments(curriculumId, learnerId, requiredAssessmentIds)
    : [];

  // Snapshotted at generate time like everything else here, so neither the learner's report list
  // nor the report itself has to fetch the course separately just to render its name — and a
  // course later renamed or deleted doesn't retitle/blank an already-published report.
  const courseName = courseId ? CourseModel.findById(courseId)?.name || null : null;

  // Same snapshotting reasoning as courseName, for a session report specifically — null for a
  // course-level final report.
  const sessionName = sessionId ? SessionModel.findById(sessionId)?.title || null : null;

  return { assessments, overall, indicatorBreakdown, competencyScores, courseName, sessionName };
}

// True once every one of the course's non-empty sessions (sessions with at least one still-
// existing attached assessment) has a published report for this learner — the new gate a course's
// "final" report has to clear, replacing the old flat "every assessment individually graded" check.
// A course with zero non-empty sessions is never ready (nothing to report), matching prior behavior.
function isCourseReadyForLearner(courseId, classId, learnerId) {
  const sessions = SessionModel.findByCourseId(courseId).filter((s) => getSessionRequiredAssessmentIds(s).length > 0);
  if (sessions.length === 0) return false;
  return sessions.every((s) => ReportModel.findOne({ learnerId, courseId, classId, sessionId: s.id })?.status === "published");
}

// Builds/refreshes a single session's report for one learner, publishing it in the same step the
// moment every assessment that session attaches is graded+published — no separate teacher click,
// no draft stage, unlike the course-level final report below. A no-op (returns the existing report
// unchanged, or null) whenever the session isn't ready yet or has nothing attached to report on;
// this runs unattended as a side effect of readiness checks, so it must never throw.
function generateSessionReport({ learnerId, session, classId, curriculumId }) {
  const requiredIds = getSessionRequiredAssessmentIds(session);
  if (requiredIds.length === 0) return null;

  const existing = ReportModel.findOne({ learnerId, courseId: session.courseId, classId, sessionId: session.id });
  const gradedIds = getPublishedGradedAssessmentIds(learnerId);
  const ready = requiredIds.every((id) => gradedIds.has(id));
  if (!ready) return existing;

  const content = buildReportContent(learnerId, requiredIds, curriculumId, session.courseId, session.id);
  if (existing) return ReportModel.update(existing.id, { content });

  // hubId mirrors the course-level report's own resolution (cls?.schoolId in generateReport) —
  // listForLearner filters on it for the portal's hub switcher, so a session report left without
  // one would silently vanish from that filtered view even though it's really published.
  const cls = ClassModel.findById(classId);
  return ReportModel.create({
    learnerId,
    courseId: session.courseId,
    classId,
    sessionId: session.id,
    hubId: cls?.schoolId || null,
    status: "published",
    generatedAt: new Date().toISOString(),
    generatedBy: "system",
    publishedAt: new Date().toISOString(),
    publishedBy: "system",
    remarks: "",
    content,
  });
}

// Lazily triggers session-report generation for every learner in a class, across every session of
// a course — called from the teacher-facing readiness endpoint below (the natural, low-risk place
// to run this) rather than hooked into assessment-submission.service.js's grade(), which would
// create a circular require between the assessments/submissions and reports modules (report.
// service.js already requires AssessmentSubmissionModel/Service, so the reverse direction isn't safe).
function ensureSessionReportsGenerated(classId, courseId, learnerIds) {
  const sessions = SessionModel.findByCourseId(courseId);
  const cls = ClassModel.findById(classId);
  learnerIds.forEach((learnerId) => {
    sessions.forEach((session) => generateSessionReport({ learnerId, session, classId, curriculumId: cls?.curriculumId }));
  });
}

// Shared by generateReport and publishReport — builds a course-level final report's content
// (the union of every session's required assessments, as buildReportContent always did) and
// attaches a sessionReports summary so the final report visibly shows what it combines.
function buildCourseReportContent(learnerId, courseId, classId) {
  const requiredAssessmentIds = getCourseRequiredAssessmentIds(courseId);
  const cls = ClassModel.findById(classId);
  const content = buildReportContent(learnerId, requiredAssessmentIds, cls?.curriculumId, courseId);

  const sessions = SessionModel.findByCourseId(courseId).filter((s) => getSessionRequiredAssessmentIds(s).length > 0);
  content.sessionReports = sessions.map((s) => {
    const report = ReportModel.findOne({ learnerId, courseId, classId, sessionId: s.id });
    return {
      sessionId: s.id,
      sessionTitle: s.title || null,
      reportId: report?.id || null,
      totalScore: report?.content?.overall?.totalScore ?? 0,
      maxScore: report?.content?.overall?.maxScore ?? 0,
      percent: report?.content?.overall?.percent ?? 0,
      publishedAt: report?.publishedAt || null,
    };
  });
  return content;
}

const ReportService = {
  // Every actively-enrolled learner in this class, whether their course report is ready to
  // generate (every session-attached assessment graded AND its own report published to the
  // learner), and any report that already exists for them — one call gives the teacher's Reports
  // page everything it needs per learner.
  getReadinessForClassCourse(classId, courseId) {
    const { attachedCount, requiredIds: requiredAssessmentIds } = getCourseAssessmentCounts(courseId);
    const sessions = SessionModel.findByCourseId(courseId);
    const learnerIds = LearnerHubLinkModel.findByClassId(classId)
      .filter((l) => l.status === "active")
      .map((l) => l.learnerId);
    const learners = LearnerModel.findAll({ ids: learnerIds });

    // Side effect: auto-generates/publishes any session report that just became ready for any of
    // these learners — this page load is the trigger, there's no separate "Generate" click for
    // session reports (see generateSessionReport's doc comment).
    ensureSessionReportsGenerated(classId, courseId, learnerIds);

    return learners.map((learner) => {
      const gradedIds = getPublishedGradedAssessmentIds(learner.id);
      const gradedCount = requiredAssessmentIds.filter((id) => gradedIds.has(id)).length;
      const sessionRows = sessions.map((session) => {
        const sessionRequiredIds = getSessionRequiredAssessmentIds(session);
        const sessionGradedCount = sessionRequiredIds.filter((id) => gradedIds.has(id)).length;
        return {
          sessionId: session.id,
          sessionTitle: session.title || null,
          order: session.order,
          requiredCount: sessionRequiredIds.length,
          gradedCount: sessionGradedCount,
          ready: sessionRequiredIds.length > 0 && sessionGradedCount === sessionRequiredIds.length,
          report: ReportModel.findOne({ learnerId: learner.id, courseId, classId, sessionId: session.id }),
        };
      });
      const ready = isCourseReadyForLearner(courseId, classId, learner.id);
      const report = ReportModel.findOne({ learnerId: learner.id, courseId, classId });
      return {
        learner,
        requiredCount: requiredAssessmentIds.length,
        // How many assessments the course's sessions reference at all — larger than requiredCount
        // when some of those assessments have since been deleted. The UI needs both to explain
        // why a course shows fewer (or zero) required assessments than its content implies.
        attachedCount,
        gradedCount,
        sessions: sessionRows,
        ready,
        report,
      };
    });
  },

  // Batched sibling of getReadinessForClassCourse — one call covers every course in a class,
  // replacing the per-(class × course) request fan-out the teacher's Reports page used to issue
  // (a teacher with 5 classes × 10 courses fired 50 parallel requests just to paint the page).
  getReadinessForClassCourses(classId, courseIds) {
    const result = {};
    courseIds.forEach((courseId) => {
      result[courseId] = ReportService.getReadinessForClassCourse(classId, courseId);
    });
    return result;
  },

  // Idempotent: re-generating an already-existing report updates its draft snapshot instead of
  // creating a duplicate (findOne on learnerId+courseId is the natural key). Throws 409 if the
  // learner isn't actually ready yet, so the client can't skip the readiness check.
  generateReport({ learnerId, courseId, classId, generatedBy }) {
    const requiredAssessmentIds = getCourseRequiredAssessmentIds(courseId);
    if (requiredAssessmentIds.length === 0) {
      const err = new Error("This course has no attached assessments to report on");
      err.statusCode = 409;
      throw err;
    }
    const ready = isCourseReadyForLearner(courseId, classId, learnerId);
    if (!ready) {
      const err = new Error("Not every session has a published report for this learner yet");
      err.statusCode = 409;
      throw err;
    }

    const content = buildCourseReportContent(learnerId, courseId, classId);

    const existing = ReportModel.findOne({ learnerId, courseId, classId });
    if (existing) return ReportModel.update(existing.id, { content });

    const cls = ClassModel.findById(classId);
    return ReportModel.create({
      learnerId, courseId, classId,
      hubId: cls?.schoolId || null,
      status: "draft",
      generatedAt: new Date().toISOString(),
      generatedBy,
      publishedAt: null,
      publishedBy: null,
      remarks: "",
      content,
    });
  },

  updateRemarks(id, remarks) {
    const report = ReportModel.findById(id);
    if (!report) notFound("Report not found");
    return ReportModel.update(id, { remarks });
  },

  // One-time draft→published transition — re-snapshots content fresh in case more grading
  // landed since the draft was generated, so what a guardian first sees is accurate. A repeat
  // call is a no-op (returns the already-published report unchanged) rather than re-snapshotting
  // scores out from under someone who's already read them.
  publishReport(id, publishedBy) {
    const report = ReportModel.findById(id);
    if (!report) notFound("Report not found");
    if (report.status === "published") return report;

    const content = buildCourseReportContent(report.learnerId, report.courseId, report.classId);
    return ReportModel.update(id, {
      content,
      status: "published",
      publishedAt: new Date().toISOString(),
      publishedBy,
    });
  },

  // Withdraws an already-published report back to draft, hiding it from the learner/guardian
  // again. Deliberately a status reversal rather than a delete: a report published in error (wrong
  // learner, scores that turned out to need re-grading) needs to be retractable, but destroying
  // the record would also lose the remarks and the generation history. Re-publishing afterwards
  // re-snapshots content, so any grading corrected in between is picked up. No-op if it's already
  // a draft, mirroring publishReport's own idempotency.
  unpublishReport(id) {
    const report = ReportModel.findById(id);
    if (!report) notFound("Report not found");
    if (report.status !== "published") return report;
    return ReportModel.update(id, { status: "draft", publishedAt: null, publishedBy: null });
  },

  getById(id) {
    return ReportModel.findById(id);
  },

  listForClassCourse({ classId, courseId }) {
    return ReportModel.findAll({ classId, courseId });
  },

  // Optional hubId scopes to the hub the learner-portal switcher is currently on — a learner
  // enrolled at several hubs shouldn't see another hub's reports mixed into this one's list, the
  // same scoping every other portal surface (courses, competencies, assessments) already applies.
  // Omitted, returns every published report across all hubs.
  listForLearner(learnerId, hubId = null) {
    const reports = ReportModel.findAll({ learnerId, status: "published" });
    return hubId ? reports.filter((r) => r.hubId === hubId) : reports;
  },
};

module.exports = ReportService;
