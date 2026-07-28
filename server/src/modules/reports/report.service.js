const ReportModel = require("./report.model");
const SessionModel = require("../courses/session.model");
const { getSessionAssessmentIds } = require("../courses/sessionAssessment.utils");
const ClassModel = require("../classes/class.model");
const LearnerModel = require("../learners/learner.model");
const LearnerHubLinkModel = require("../learners/learner-hub-link.model");
const AssessmentModel = require("../assessments/assessment.model");
const AssessmentSubmissionModel = require("../assessments/submissions/assessment-submission.model");
const AssessmentSubmissionService = require("../assessments/submissions/assessment-submission.service");

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
  const sessions = SessionModel.findByCourseId(courseId);
  const ids = new Set();
  sessions.forEach((session) => getSessionAssessmentIds(session).forEach((id) => ids.add(id)));
  return [...ids].filter((id) => !!AssessmentModel.findById(id));
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

function buildReportContent(learnerId, requiredAssessmentIds) {
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

  return { assessments, overall, indicatorBreakdown };
}

const ReportService = {
  // Every actively-enrolled learner in this class, whether their course report is ready to
  // generate (every session-attached assessment graded AND its own report published to the
  // learner), and any report that already exists for them — one call gives the teacher's Reports
  // page everything it needs per learner.
  getReadinessForClassCourse(classId, courseId) {
    const requiredAssessmentIds = getCourseRequiredAssessmentIds(courseId);
    const learnerIds = LearnerHubLinkModel.findByClassId(classId)
      .filter((l) => l.status === "active")
      .map((l) => l.learnerId);
    const learners = LearnerModel.findAll({ ids: learnerIds });

    return learners.map((learner) => {
      const gradedIds = getPublishedGradedAssessmentIds(learner.id);
      const gradedCount = requiredAssessmentIds.filter((id) => gradedIds.has(id)).length;
      const ready = requiredAssessmentIds.length > 0 && gradedCount === requiredAssessmentIds.length;
      const report = ReportModel.findOne({ learnerId: learner.id, courseId });
      return {
        learner,
        requiredCount: requiredAssessmentIds.length,
        gradedCount,
        ready,
        report,
      };
    });
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
    const gradedIds = getPublishedGradedAssessmentIds(learnerId);
    const ready = requiredAssessmentIds.every((id) => gradedIds.has(id));
    if (!ready) {
      const err = new Error("Not every assessment in this course has been graded for this learner yet");
      err.statusCode = 409;
      throw err;
    }

    const cls = ClassModel.findById(classId);
    const content = buildReportContent(learnerId, requiredAssessmentIds);

    const existing = ReportModel.findOne({ learnerId, courseId });
    if (existing) return ReportModel.update(existing.id, { content });

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

    const requiredAssessmentIds = getCourseRequiredAssessmentIds(report.courseId);
    const content = buildReportContent(report.learnerId, requiredAssessmentIds);
    return ReportModel.update(id, {
      content,
      status: "published",
      publishedAt: new Date().toISOString(),
      publishedBy,
    });
  },

  getById(id) {
    return ReportModel.findById(id);
  },

  listForClassCourse({ classId, courseId }) {
    return ReportModel.findAll({ classId, courseId });
  },

  listForLearner(learnerId) {
    return ReportModel.findAll({ learnerId, status: "published" });
  },
};

module.exports = ReportService;
