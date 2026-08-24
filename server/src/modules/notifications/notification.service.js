const NotificationModel = require("./notification.model");
const UserModel = require("../auth/user.model");
const LearnerModel = require("../learners/learner.model");
const TeacherModel = require("../teachers/teacher.model");
const ClassModel = require("../classes/class.model");
const ClassCourseTeacherLinkModel = require("../classes/class-course-teacher-link.model");
const AssessmentIssueModel = require("../assessments/submissions/assessment-issue.model");
const AssessmentModel = require("../assessments/assessment.model");
const CompetencyService = require("../curriculum/competency-framework/competency.service");

const NotificationService = {
  async listForMe(recipientId) {
    const [items, unreadCount] = await Promise.all([
      NotificationModel.findForRecipient(recipientId),
      NotificationModel.countUnread(recipientId),
    ]);
    return { items, unreadCount };
  },

  markRead(id, recipientId) {
    return NotificationModel.markRead(id, recipientId);
  },

  markAllRead(recipientId) {
    return NotificationModel.markAllRead(recipientId);
  },

  async invoiceIssued(invoice) {
    return NotificationService._notify(invoice.payerUserId, {
      type: "invoice_issued",
      title: "New invoice issued",
      message: `${invoice.invoiceNumber} is ready. Amount due: ${invoice.currency} ${invoice.amountDue}.`,
      payload: { invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber, route: "/learner-portal/invoices/" },
      dedupeKey: `invoice_issued:${invoice.id}`,
    });
  },

  // Base primitive every event below fans out through. dedupeKey is optional — only events that
  // can legitimately recompute to "still true" on a later trigger need it (see maybeNotifyLevelUp);
  // everything else is a genuine one-time state transition and gets a fresh row every time.
  async _notify(recipientId, { type, title, message, payload = null, dedupeKey = null }) {
    if (!recipientId) return null;
    if (dedupeKey) {
      const existing = await NotificationModel.findOne({ recipientId, dedupeKey });
      if (existing) return existing;
    }
    return NotificationModel.create({ recipientId, type, title, message, payload, dedupeKey });
  },

  // Fans out to every login this learner actually has — a guardian-mediated account (matched by
  // guardianEmail) and/or the learner's own dedicated username login (see auth.service.js's
  // setOrCreatePasswordByUsername) — since either, both, or neither may exist, and both need to
  // know when they do.
  async notifyLearner(learnerId, event) {
    const learner = await LearnerModel.findById(learnerId);
    if (!learner) return;
    const recipientIds = [];
    if (learner.guardianEmail) {
      const guardianUser = await UserModel.findByEmail(learner.guardianEmail);
      if (guardianUser) recipientIds.push(guardianUser.id);
    }
    if (learner.username) {
      const learnerUser = await UserModel.findByUsername(learner.username);
      if (learnerUser) recipientIds.push(learnerUser.id);
    }
    await Promise.all(recipientIds.map((id) => NotificationService._notify(id, event)));
  },

  // The educator of record for a (class, course) pair — see class-course-teacher-link.model.js's
  // isPrimary. Falls back to whichever co-teacher link exists if none is marked primary, rather
  // than notifying nobody.
  async notifyClassCourseTeacher(classId, courseId, event) {
    if (!classId || !courseId) return;
    const links = await ClassCourseTeacherLinkModel.findByClassAndCourse(classId, courseId);
    const link = links.find((l) => l.isPrimary) || links[0];
    if (!link) return;
    const teacher = await TeacherModel.findById(link.teacherId);
    if (!teacher?.email) return;
    const user = await UserModel.findByEmail(teacher.email);
    await NotificationService._notify(user?.id, event);
  },

  // Fired once a submission reaches "graded" — either instantly (fully auto-gradable, see
  // submit()) or via a teacher's grade() pass.
  async assessmentGraded(submission) {
    const assessment = await AssessmentModel.findById(submission.assessmentId);
    const percent = submission.maxScore > 0 ? Math.round((submission.totalScore / submission.maxScore) * 100) : null;
    await NotificationService.notifyLearner(submission.learnerId, {
      type: "assessment_graded",
      title: "Assessment graded",
      message: `"${assessment?.name || "Your assessment"}" has been graded${percent != null ? ` — ${percent}%` : ""}.`,
      // issueId/learnerId are what the learner-portal's assessment detail route
      // (/learner-portal/assessments/:issueId) and its "which sibling is active" switcher
      // actually key off — see NotificationBell.jsx's click handler.
      payload: { assessmentId: submission.assessmentId, submissionId: submission.id, issueId: submission.issueId, learnerId: submission.learnerId },
    });
  },

  // Fired when a submission lands in "submitted" (needs a teacher's grading pass) — only for
  // class-issued work, where there's an actual educator of record to resolve. A standalone
  // diagnostic/course-progress issue (classId: null) has no single (class, course) owner, so
  // it's skipped rather than guessed at.
  async assessmentSubmitted(submission) {
    if (!submission.classId) return;
    const issue = await AssessmentIssueModel.findById(submission.issueId);
    if (!issue?.courseId) return;
    const assessment = await AssessmentModel.findById(submission.assessmentId);
    const learner = await LearnerModel.findById(submission.learnerId);
    await NotificationService.notifyClassCourseTeacher(submission.classId, issue.courseId, {
      type: "assessment_submitted",
      title: "New submission to grade",
      message: `${learner ? `${learner.firstName} ${learner.lastName}` : "A learner"} submitted "${assessment?.name || "an assessment"}".`,
      // issueId is what the teacher-portal's roster route (/teacher-portal/assessments/:issueId)
      // keys off — see NotificationBell.jsx's click handler.
      payload: { assessmentId: submission.assessmentId, submissionId: submission.id, classId: submission.classId, issueId: submission.issueId },
    });
  },

  async sessionReportPublished(report) {
    const percent = report.content?.overall?.percent;
    await NotificationService.notifyLearner(report.learnerId, {
      type: "session_report_published",
      title: "New session report",
      message: `A new report is ready${report.content?.sessionName ? ` for "${report.content.sessionName}"` : ""}${percent != null ? ` — ${percent}%` : ""}.`,
      payload: { reportId: report.id, learnerId: report.learnerId },
    });
  },

  // Checks whether this learner just crossed into a NEW Performance Band on this curriculum —
  // "current" is the highest-order band with thresholdMet true, the identical rule
  // bandJourney.js's deriveBandJourney applies client-side, mirrored here so the two can never
  // disagree about what counts as "leveled up". dedupeKey means this fires exactly once per
  // (learner, band) — without it, every later grading event would re-fire it for as long as the
  // band stays achieved.
  async maybeNotifyLevelUp(learnerId, classId) {
    if (!classId) return;
    const cls = await ClassModel.findById(classId);
    if (!cls?.curriculumId) return;
    const bandProgress = await CompetencyService.getLearnerBandProgress(cls.curriculumId, learnerId);
    const achieved = bandProgress.filter((bp) => bp.thresholdMet);
    if (!achieved.length) return;
    const current = achieved[achieved.length - 1];
    await NotificationService.notifyLearner(learnerId, {
      type: "level_up",
      title: "Level up!",
      message: `You've unlocked the ${current.name} level — keep going!`,
      payload: { bandId: current.bandId, bandName: current.name, curriculumId: cls.curriculumId, learnerId },
      dedupeKey: `level_up:${learnerId}:${current.bandId}`,
    });
  },
};

module.exports = NotificationService;
