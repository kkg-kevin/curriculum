const ReportModel = require("./report.model");
const SessionModel = require("../courses/session.model");
const { getSessionAssessmentIds } = require("../courses/sessionAssessment.utils");
const ClassModel = require("../classes/class.model");
const LearningHubModel = require("../learning-hubs/learning-hub.model");
const CourseModel = require("../courses/course.model");
const LearnerModel = require("../learners/learner.model");
const LearnerHubLinkModel = require("../learners/learner-hub-link.model");
const AssessmentModel = require("../assessments/assessment.model");
const AssessmentSubmissionModel = require("../assessments/submissions/assessment-submission.model");
const AssessmentSubmissionService = require("../assessments/submissions/assessment-submission.service");
const CompetencyService = require("../curriculum/competency-framework/competency.service");
const AttendanceModel = require("../attendance/attendance.model");
const NotificationService = require("../notifications/notification.service");

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
async function getSessionRequiredAssessmentIds(session) {
  const ids = getSessionAssessmentIds(session);
  const found = await Promise.all(ids.map((id) => AssessmentModel.findById(id)));
  return ids.filter((id, i) => !!found[i]);
}

// A submission only counts toward a course report once its own report has been published to the
// learner (see assessment-submission.service.js's publishReport) — otherwise a course report
// could reveal a score the learner hasn't seen released on that assessment's own page yet.
async function getPublishedGradedAssessmentIds(learnerId) {
  const submissions = await AssessmentSubmissionModel.findAll({ learnerId, status: "graded" });
  return new Set(submissions.filter((s) => s.reportPublished).map((s) => s.assessmentId));
}

async function buildReportContent(learnerId, requiredAssessmentIds, curriculumId, courseId, sessionId = null) {
  const publishedIds = await getPublishedGradedAssessmentIds(learnerId);
  const graded = await AssessmentSubmissionModel.findAll({ learnerId, status: "graded" });
  const submissions = graded.filter((s) => requiredAssessmentIds.includes(s.assessmentId) && publishedIds.has(s.assessmentId));

  const assessments = await Promise.all(submissions.map(async (s) => {
    const assessment = await AssessmentModel.findById(s.assessmentId);
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
      // Who graded it — see AssessmentSubmissionService.resolveGraderName for the Teacher-id-or-
      // Users-id resolution. Surfaced alongside gradedAt so feedback in a report always reads
      // with "who said this, and when" rather than just the comment on its own.
      gradedByName: await AssessmentSubmissionService.resolveGraderName(s.gradedBy),
      // The teacher's written comment from grading (GradingPanel.jsx) — never surfaced anywhere
      // in the report before; without it a report showed only a number, not what the teacher
      // actually said about the work.
      feedback: s.overallFeedback || "",
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
    curriculumId
  );

  // The curriculum's own score/level/band per competency — a different number from the flat
  // indicatorBreakdown above, same pair shown together on the graded assessment view and the
  // Profile Competencies tab. Scoped to THIS course's assessments, matching indicatorBreakdown:
  // a course report shouldn't fold in competency standing the learner earned on other courses.
  const competencyScores = curriculumId
    ? await CompetencyService.getLearnerCompetencyScoresForAssessments(curriculumId, learnerId, requiredAssessmentIds)
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

// True once every one of the course's non-empty sessions (sessions with at least one still-
// existing attached assessment) has a published report for this learner — the new gate a course's
// "final" report has to clear, replacing the old flat "every assessment individually graded" check.
// A course with zero non-empty sessions is never ready (nothing to report), matching prior behavior.
async function isCourseReadyForLearner(courseId, classId, learnerId) {
  const allSessions = await SessionModel.findByCourseId(courseId);
  const requiredPerSession = await Promise.all(allSessions.map((s) => getSessionRequiredAssessmentIds(s)));
  const sessions = allSessions.filter((s, i) => requiredPerSession[i].length > 0);
  if (sessions.length === 0) return false;
  const reports = await Promise.all(sessions.map((s) => ReportModel.findOne({ learnerId, courseId, classId, sessionId: s.id })));
  return reports.every((r) => r?.status === "published");
}

// Builds/refreshes a single session's report for one learner, publishing it in the same step the
// moment every assessment that session attaches is graded+published — no separate teacher click,
// no draft stage, unlike the course-level final report below. A no-op (returns the existing report
// unchanged, or null) whenever the session isn't ready yet or has nothing attached to report on;
// this runs unattended as a side effect of readiness checks, so it must never throw.
async function generateSessionReport({ learnerId, session, classId, curriculumId }) {
  const requiredIds = await getSessionRequiredAssessmentIds(session);
  if (requiredIds.length === 0) return null;

  const existing = await ReportModel.findOne({ learnerId, courseId: session.courseId, classId, sessionId: session.id });
  const gradedIds = await getPublishedGradedAssessmentIds(learnerId);
  const ready = requiredIds.every((id) => gradedIds.has(id));
  if (!ready) return existing;

  const content = await buildReportContent(learnerId, requiredIds, curriculumId, session.courseId, session.id);
  if (existing) return ReportModel.update(existing.id, { content });

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

// Shared by generateReport and publishReport — builds a course-level final report's content
// (the union of every session's required assessments, as buildReportContent always did) and
// attaches a sessionReports summary so the final report visibly shows what it combines.
async function buildCourseReportContent(learnerId, courseId, classId) {
  const requiredAssessmentIds = await getCourseRequiredAssessmentIds(courseId);
  const cls = await ClassModel.findById(classId);
  const content = await buildReportContent(learnerId, requiredAssessmentIds, cls?.curriculumId, courseId);

  const allSessions = await SessionModel.findByCourseId(courseId);
  const requiredPerSession = await Promise.all(allSessions.map((s) => getSessionRequiredAssessmentIds(s)));
  const sessions = allSessions.filter((s, i) => requiredPerSession[i].length > 0);

  content.sessionReports = await Promise.all(sessions.map(async (s) => {
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
  return content;
}

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
    const requiredIds = await getSessionRequiredAssessmentIds(session);
    const links = await LearnerHubLinkModel.findByClassId(classId);
    const learnerIds = links.filter((l) => l.status === "active").map((l) => l.learnerId);
    const learners = await LearnerModel.findAll({ ids: learnerIds });

    const learnerRows = await Promise.all(learners.map(async (learner) => {
      // Same lazy generate-on-read trigger getReadinessForClassCourse applies, scoped to just
      // this session — so opening a session's summary is enough to publish its report the moment
      // it becomes ready, without waiting for the course's full Reports page to be opened too.
      await generateSessionReport({ learnerId: learner.id, session, classId, curriculumId: cls?.curriculumId });
      const gradedIds = await getPublishedGradedAssessmentIds(learner.id);
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
      requiredCount: requiredIds.length,
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
    const links = await LearnerHubLinkModel.findByClassId(classId);
    const learnerIds = links.filter((l) => l.status === "active").map((l) => l.learnerId);
    const learners = await LearnerModel.findAll({ ids: learnerIds });

    // Side effect: auto-generates/publishes any session report that just became ready for any of
    // these learners — this page load is the trigger, there's no separate "Generate" click for
    // session reports (see generateSessionReport's doc comment).
    await ensureSessionReportsGenerated(classId, courseId, learnerIds);

    return Promise.all(learners.map(async (learner) => {
      const gradedIds = await getPublishedGradedAssessmentIds(learner.id);
      const gradedCount = requiredAssessmentIds.filter((id) => gradedIds.has(id)).length;
      const sessionRows = await Promise.all(sessions.map(async (session) => {
        const sessionRequiredIds = await getSessionRequiredAssessmentIds(session);
        const sessionGradedCount = sessionRequiredIds.filter((id) => gradedIds.has(id)).length;
        return {
          sessionId: session.id,
          sessionTitle: session.title || null,
          order: session.order,
          requiredCount: sessionRequiredIds.length,
          gradedCount: sessionGradedCount,
          ready: sessionRequiredIds.length > 0 && sessionGradedCount === sessionRequiredIds.length,
          report: await ReportModel.findOne({ learnerId: learner.id, courseId, classId, sessionId: session.id }),
        };
      }));
      const ready = await isCourseReadyForLearner(courseId, classId, learner.id);
      const report = await ReportModel.findOne({ learnerId: learner.id, courseId, classId });
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
    }));
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

  // Idempotent: re-generating an already-existing report updates its draft snapshot instead of
  // creating a duplicate (findOne on learnerId+courseId is the natural key). Throws 409 if the
  // learner isn't actually ready yet, so the client can't skip the readiness check.
  async generateReport({ learnerId, courseId, classId, generatedBy }) {
    const requiredAssessmentIds = await getCourseRequiredAssessmentIds(courseId);
    if (requiredAssessmentIds.length === 0) {
      const err = new Error("This course has no attached assessments to report on");
      err.statusCode = 409;
      throw err;
    }
    const ready = await isCourseReadyForLearner(courseId, classId, learnerId);
    if (!ready) {
      const err = new Error("Not every session has a published report for this learner yet");
      err.statusCode = 409;
      throw err;
    }

    const content = await buildCourseReportContent(learnerId, courseId, classId);

    const existing = await ReportModel.findOne({ learnerId, courseId, classId });
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

  // Editable only while still a draft — once published, a report is the learner/guardian's
  // permanent record of what they were told; changing it after the fact without a trace would
  // undermine that. A teacher who genuinely needs to correct it withdraws to draft first (see
  // unpublishReport), which re-opens editing and re-snapshots content on the next publish.
  async updateRemarks(id, remarks) {
    const report = await ReportModel.findById(id);
    if (!report) notFound("Report not found");
    if (report.status === "published") {
      const err = new Error("This report is published and locked — withdraw it to draft first to change the remarks");
      err.statusCode = 409;
      throw err;
    }
    return ReportModel.update(id, { remarks });
  },

  // One-time draft→published transition — re-snapshots content fresh in case more grading
  // landed since the draft was generated, so what a guardian first sees is accurate. A repeat
  // call is a no-op (returns the already-published report unchanged) rather than re-snapshotting
  // scores out from under someone who's already read them.
  async publishReport(id, publishedBy) {
    const report = await ReportModel.findById(id);
    if (!report) notFound("Report not found");
    if (report.status === "published") return report;

    const content = await buildCourseReportContent(report.learnerId, report.courseId, report.classId);
    return ReportModel.update(id, {
      content,
      status: "published",
      publishedAt: new Date(),
      publishedBy,
    });
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
    return ReportModel.update(id, { status: "draft", publishedAt: null, publishedBy: null });
  },

  async getById(id) {
    return ReportModel.findById(id);
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
    return hubId ? reports.filter((r) => r.hubId === hubId) : reports;
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

    const finalReports = allReports.filter((r) => r.sessionId === null);
    const publishedFinals = finalReports.filter((r) => r.status === "published");
    const draftFinals = finalReports.filter((r) => r.status === "draft");
    const scored = publishedFinals.filter((r) => r.content?.overall?.percent != null);

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
      averageScore,
      scoreByCourse,
      competencyScores,
      attendanceRate,
      attendanceTrend,
      classBreakdown,
    };
  },

  // The platform-admin sibling of getHubAnalytics above — same computation, unscoped across every
  // hub, plus a hub-by-hub breakdown (the admin-only view a single school's own Reports page can
  // never show: which hubs are thriving vs falling behind). Deliberately reads the raw
  // Report/Attendance rows directly rather than composing from N calls to getHubAnalytics — that
  // would mean re-averaging already-rounded per-hub numbers, compounding rounding error and losing
  // the correct per-report/per-record weighting the single-hub version gets for free.
  async getPlatformAnalytics({ days = 30 } = {}) {
    const hubs = await LearningHubModel.findAll({});
    const classes = await ClassModel.findAll();
    const hubIdByClassId = {};
    classes.forEach((c) => { hubIdByClassId[c.id] = c.schoolId; });

    const links = await LearnerHubLinkModel.findAll();
    const activeLinks = links.filter((l) => l.status === "active");
    const activeLearnerCountByHub = {};
    activeLinks.forEach((l) => {
      activeLearnerCountByHub[l.hubId] = (activeLearnerCountByHub[l.hubId] || 0) + 1;
    });

    const allReports = await ReportModel.findAll({});
    const finalReports = allReports.filter((r) => r.sessionId === null);
    const publishedFinals = finalReports.filter((r) => r.status === "published");
    const draftFinals = finalReports.filter((r) => r.status === "draft");
    const scored = publishedFinals.filter((r) => r.content?.overall?.percent != null);

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
    // One unscoped query across every class, instead of getHubAnalytics's per-class loop — that
    // loop exists there because AttendanceModel.findAll only takes one classId at a time; fetching
    // every hub's worth of classes individually here would mean one query per class platform-wide.
    const allAttendance = await AttendanceModel.findAll({ dateFrom });
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
      return {
        hubId: hub.id,
        name: hub.name,
        classCount: classCountByHub[hub.id] || 0,
        learnerCount: activeLearnerCountByHub[hub.id] || 0,
        averageScore: hubScored.length
          ? Math.round(hubScored.reduce((sum, r) => sum + r.content.overall.percent, 0) / hubScored.length)
          : null,
        attendanceRate: hubAttendance ? Math.round((hubAttendance.present / hubAttendance.total) * 100) : null,
        publishedCount: publishedFinals.filter((r) => r.hubId === hub.id).length,
        draftCount: draftFinals.filter((r) => r.hubId === hub.id).length,
      };
    });

    return {
      hubCount: hubs.length,
      classCount: classes.length,
      activeLearnerCount: activeLinks.length,
      reportStats: { published: publishedFinals.length, draft: draftFinals.length },
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
