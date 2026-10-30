const NotificationModel = require("./notification.model");
const UserModel = require("../auth/user.model");
const { adminIdsOf } = require("../../shared/utils/organisation");
const LearnerModel = require("../learners/learner.model");
const TeacherModel = require("../teachers/teacher.model");
const ClassModel = require("../classes/class.model");
const ClassCourseTeacherLinkModel = require("../classes/class-course-teacher-link.model");
const AssessmentIssueModel = require("../assessments/submissions/assessment-issue.model");
const AssessmentModel = require("../assessments/assessment.model");
const CompetencyService = require("../curriculum/competency-framework/competency.service");
const { sendNotificationEmail, describePreferences, mergePreferences, describeWorkspaceEmails, saveWorkspaceEmails, userForPreferencesToken } = require("./notification.emails");

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
    return NotificationService.notifyPerson(invoice.payerUserId, {
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
  // ownerAdminId, when the caller knows it, is the workspace the event happened in — it decides
  // whether that workspace has this email switched off (otherwise it's worked out from the
  // recipient).
  //
  // A recipient that is an organisation's key means "the admin" — callers hand over
  // `ownerAdminId` for that — so it goes to every admin of that organisation, not to whichever
  // one's user id happens to be the key.
  async _notify(recipientId, event) {
    if (!recipientId) return null;
    const adminIds = await adminIdsOf(recipientId);
    if (adminIds.length > 1) {
      const sent = await Promise.all(adminIds.map((id) => this._deliver(id, event)));
      return sent[0];
    }
    return this._deliver(recipientId, event);
  },

  // One specific person — a parent, a learner, an educator, a supervisor, a payer — never fanned
  // out to an organisation's admins the way _notify fans out "the admin". An admin who is also an
  // educator or a parent (one login, several roles — account-roles.js) is that organisation's
  // key, so _notify would hand their own notifications to every admin.
  notifyPerson(userId, event) {
    return NotificationService._deliver(userId, event);
  },

  async _deliver(recipientId, { type, title, message, payload = null, dedupeKey = null, ownerAdminId = null }) {
    if (!recipientId) return null;
    if (dedupeKey) {
      const existing = await NotificationModel.findOne({ recipientId, dedupeKey });
      if (existing) return existing;
    }
    const created = await NotificationModel.create({ recipientId, type, title, message, payload, dedupeKey });
    // Emailed too, for the types and recipients that allow it (see notification.emails.js) —
    // only for a notification that was actually just created, never a deduped repeat.
    // Fire-and-forget: the in-app notification is the record, the email is a courtesy.
    sendNotificationEmail({ ...created, payload, ownerAdminId });
    return created;
  },

  async getEmailPreferences(userId) {
    const user = await UserModel.findById(userId);
    return describePreferences(user || {});
  },

  async updateEmailPreferences(userId, data) {
    const user = await UserModel.findById(userId);
    if (!user) throw Object.assign(new Error("User not found"), { statusCode: 404 });
    const updated = await UserModel.update(userId, { emailPreferences: mergePreferences(user, data) });
    return describePreferences(updated);
  },

  // The same two, reached from the link in an email's footer instead of a signed-in session.
  async getEmailPreferencesByToken(token) {
    const user = await userForPreferencesToken(token);
    if (!user) throw Object.assign(new Error("This link isn't valid. Sign in to change your email settings."), { statusCode: 404 });
    return describePreferences(user);
  },

  async updateEmailPreferencesByToken(token, data) {
    const user = await userForPreferencesToken(token);
    if (!user) throw Object.assign(new Error("This link isn't valid. Sign in to change your email settings."), { statusCode: 404 });
    return NotificationService.updateEmailPreferences(user.id, data);
  },

  // Which emails a whole workspace sends — the admin's switches (Settings → Emails).
  getWorkspaceEmails: (ownerAdminId) => describeWorkspaceEmails(ownerAdminId),
  saveWorkspaceEmails: (ownerAdminId, types) => saveWorkspaceEmails(ownerAdminId, types),

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
    // An educator learning (TOT — learners.teacherId) hears as the educator: their own login.
    if (learner.teacherId) {
      const teacher = await TeacherModel.findById(learner.teacherId);
      const educatorUser = teacher?.email ? await UserModel.findByEmail(teacher.email) : null;
      if (educatorUser) recipientIds.push(educatorUser.id);
    }
    await Promise.all([...new Set(recipientIds)].map((id) => NotificationService.notifyPerson(id, event)));
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
    await NotificationService.notifyPerson(user?.id, event);
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

  // A certificate (course, pathway or bootcamp) was just issued (see certificate.service.js). dedupeKey: once per
  // certificate, so a report withdrawn and published again doesn't announce it twice.
  async certificateIssued(certificate) {
    const title = certificate.snapshot?.title || certificate.snapshot?.courseName;
    await NotificationService.notifyLearner(certificate.learnerId, {
      type: "certificate_issued",
      title: "Certificate earned",
      message: `You've earned a certificate${title ? ` for completing "${title}"` : ""}.`,
      payload: { certificateId: certificate.id, learnerId: certificate.learnerId },
      dedupeKey: `certificate:${certificate.id}`,
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
