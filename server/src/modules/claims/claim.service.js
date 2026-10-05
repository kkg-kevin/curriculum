const crypto = require("crypto");
const ClaimModel = require("./claim.model");
const ClaimSettingsModel = require("./claim-settings.model");
const ClaimNotifications = require("./claim.notifications");
const ClassCourseTeacherLinkModel = require("../classes/class-course-teacher-link.model");
const ClassModel = require("../classes/class.model");
const CourseModel = require("../courses/course.model");
const SessionModel = require("../courses/session.model");
const LearningHubModel = require("../learning-hubs/learning-hub.model");
const TeacherModel = require("../teachers/teacher.model");
const UserModel = require("../auth/user.model");
const AttendanceModel = require("../attendance/attendance.model");
const TimetableModel = require("../timetable/timetable.model");
const CourseScheduleModel = require("../timetable/course-schedule.model");
const TimetableService = require("../timetable/timetable.service");
const SessionOccurrenceService = require("../timetable/session-occurrence.service");
const SessionOccurrenceModel = require("../timetable/session-occurrence.model");
const ReportService = require("../reports/report.service");

// Educator claims — how an educator gets paid for a course they teach.
//
// An educator is paid per session. A course's value is its sessions × the session rate (the
// educator's own rate if they have one, otherwise the workspace's — see claim-settings.model.js),
// rounded to a whole shilling. From that:
//   advance  a fixed share of the whole course's value (30% unless the workspace changed it),
//            requestable once per course while it is still running;
//   full     the course's value less any advance already requested, requestable once every
//            session has been delivered.
//
// A session counts as delivered once its date has passed on the class's timetable and it wasn't
// cancelled (session_occurrences is the durable record — see session-occurrence.service.js). A
// cancelled session isn't paid for, so it comes off the course's value too.
//
// Every figure on a claim is fixed when it is submitted. Where it goes next depends on whether
// the educator has a supervisor (teachers.supervisorId — see supervisor.service.js):
//   with one     the supervisor approves or declines it; an approved claim is the admin's to pay.
//   without one  it goes straight to the admin, who approves or declines it and then pays.
// A declined claim always carries a reason the educator sees, and they can claim again.

const DAY_MS = 24 * 60 * 60 * 1000;
const PENDING = ["pending_supervisor", "pending_admin"];
const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

const todayStr = () => new Date().toISOString().slice(0, 10);
const wholeShillings = (value) => Math.round(Number(value) || 0);
const resolveCalendar = (args) => TimetableService.resolveCalendar(args);
const percent = (done, of) => (of > 0 ? Math.round((done / of) * 100) : null);

function fail(message, statusCode = 400) {
  throw Object.assign(new Error(message), { statusCode });
}

function weekdayOf(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

function hoursBetween(startTime, endTime) {
  if (!startTime || !endTime) return 0;
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  return Math.max(0, (eh * 60 + em - (sh * 60 + sm)) / 60);
}

// The supervisor an educator's claims go to — null when they have none, or when the account they
// point at is gone or no longer a supervisor.
async function supervisorOf(teacher) {
  if (!teacher?.supervisorId) return null;
  const user = await UserModel.findById(teacher.supervisorId);
  return user && user.role === "supervisor" ? { id: user.id, name: user.name } : null;
}

const classLabel = (cls) => [cls?.gradeName, cls?.streamName].filter(Boolean).join(" ").trim() || null;
const teacherName = (teacher) => [teacher?.firstName, teacher?.lastName].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();

// The class's past sessions as the timetable records them. The sync is what creates those
// records from the calendar; if it can't run (a class with a half-configured timetable) the
// records already on file are still the right answer.
async function occurrencesFor(classId) {
  try {
    return await SessionOccurrenceService.syncClassOccurrences(classId, resolveCalendar);
  } catch (err) {
    console.error(`[claims] could not sync sessions for class ${classId}:`, err.message);
    return SessionOccurrenceModel.findByClassId(classId);
  }
}

// What a session of this course pays this educator.
function rateFor(teacher, settings) {
  const own = teacher?.sessionRate == null ? null : Number(teacher.sessionRate);
  return own && own > 0 ? own : settings.sessionRate;
}

// Everything money-related about one (educator, class, course): what the course is worth, what
// has been earned and requested so far, and what can be requested now.
function buildFigures({ teacher, course, sessions, occurrences, slots, settings, claims }) {
  const today = todayStr();
  const sessionIds = new Set(sessions.map((s) => s.id));
  const past = occurrences.filter((o) => o.courseId === course.id && sessionIds.has(o.sessionId) && o.date <= today);
  const delivered = past.filter((o) => o.status !== "cancelled");
  const deliveredIds = new Set(delivered.map((o) => o.sessionId));
  // Cancelled and never made up on another date.
  const cancelledIds = new Set(past.filter((o) => o.status === "cancelled" && !deliveredIds.has(o.sessionId)).map((o) => o.sessionId));

  const sessionsTotal = sessions.length - cancelledIds.size;
  const sessionsDelivered = deliveredIds.size;
  const sessionRate = rateFor(teacher, settings);
  const courseAmount = wholeShillings(sessionsTotal * sessionRate);
  const earnedAmount = wholeShillings(sessionsDelivered * sessionRate);
  const advanceAmount = wholeShillings((courseAmount * settings.advancePercent) / 100);

  const live = claims.filter((c) => c.status !== "rejected");
  const advances = live.filter((c) => c.type === "advance");
  const fullClaim = live.find((c) => c.type === "full") || null;
  const sum = (rows) => rows.reduce((total, c) => total + c.amount, 0);
  const advanceRequested = sum(advances);
  const advancePaid = sum(advances.filter((c) => c.status === "paid"));
  const balance = Math.max(0, courseAmount - advanceRequested);
  const remaining = Math.max(0, sessionsTotal - sessionsDelivered);

  let advanceBlocked = null;
  if (sessionsTotal === 0) advanceBlocked = "This course has no sessions yet.";
  else if (fullClaim) advanceBlocked = "The full payment has already been requested for this course.";
  else if (advances.length) advanceBlocked = "An advance has already been requested for this course.";
  else if (remaining === 0) advanceBlocked = "Every session is delivered — request the full payment instead.";

  let fullBlocked = null;
  if (sessionsTotal === 0) fullBlocked = "This course has no sessions yet.";
  else if (fullClaim) fullBlocked = "The full payment has already been requested for this course.";
  else if (advances.some((c) => PENDING.includes(c.status))) fullBlocked = "Your advance request is still being reviewed.";
  else if (remaining > 0) fullBlocked = `${remaining} ${remaining === 1 ? "session is" : "sessions are"} still to be delivered.`;
  else if (balance <= 0) fullBlocked = "Nothing is left to claim for this course.";

  // Time actually spent teaching: each delivered session's slot length on the day it ran.
  const courseSlots = slots.filter((s) => s.courseId === course.id);
  const hours = delivered.reduce((total, o) => {
    const slot = courseSlots.find((s) => s.dayOfWeek === weekdayOf(o.date)) || courseSlots[0];
    return total + (slot ? hoursBetween(slot.startTime, slot.endTime) : 0);
  }, 0);

  let stage = "not_started";
  if (fullClaim?.status === "paid") stage = "paid";
  else if (fullClaim?.status === "approved") stage = "approved";
  else if (live.some((c) => PENDING.includes(c.status))) stage = "in_review";
  else if (!fullBlocked) stage = "ready";
  else if (sessionsDelivered > 0) stage = "in_progress";

  return {
    currency: settings.currency,
    sessionRate,
    advancePercent: settings.advancePercent,
    sessionsTotal,
    sessionsDelivered,
    sessionsCancelled: cancelledIds.size,
    courseAmount,
    earnedAmount,
    advanceAmount,
    advanceRequested,
    advancePaid,
    balance,
    hours: Math.round(hours * 10) / 10,
    stage,
    canRequestAdvance: !advanceBlocked,
    advanceBlocked,
    canRequestFull: !fullBlocked,
    fullBlocked,
  };
}

function describeCourse({ link, cls, course, hub }) {
  return {
    classId: cls.id,
    courseId: course.id,
    courseName: course.name,
    className: classLabel(cls),
    academicYear: cls.academicYear || null,
    isPrimary: Boolean(link?.isPrimary),
    hub: hub ? { id: hub.id, name: hub.name, hubType: hub.hubType, isHomeLearning: Boolean(hub.isHomeLearning) } : null,
  };
}

// The class, course and hub behind a link — null when the class or course no longer exists.
async function loadCourseContext(classId, courseId) {
  const [cls, course] = await Promise.all([ClassModel.findById(classId), CourseModel.findById(courseId)]);
  if (!cls || !course) return null;
  const hub = cls.schoolId ? await LearningHubModel.findById(cls.schoolId) : null;
  return { cls, course, hub };
}

const ClaimService = {
  // --- The educator's side ------------------------------------------------------------------

  // Every course the educator teaches, with what each is worth and where its claim stands, plus
  // the totals across all of them.
  async listMyCourses(teacher) {
    const links = await ClassCourseTeacherLinkModel.findByTeacherId(teacher.id);
    const claims = await ClaimModel.findAll({ teacherId: teacher.id });

    const classIds = [...new Set(links.map((l) => l.classId))];
    const courseIds = [...new Set(links.map((l) => l.courseId))];
    const [classes, courses, allSessions, allSlots] = await Promise.all([
      Promise.all(classIds.map((id) => ClassModel.findById(id))),
      Promise.all(courseIds.map((id) => CourseModel.findById(id))),
      SessionModel.findByCourseIds(courseIds),
      TimetableModel.findByClassIds(classIds),
    ]);
    const classById = new Map(classes.filter(Boolean).map((c) => [c.id, c]));
    const courseById = new Map(courses.filter(Boolean).map((c) => [c.id, c]));

    const hubIds = [...new Set([...classById.values()].map((c) => c.schoolId).filter(Boolean))];
    const hubs = await Promise.all(hubIds.map((id) => LearningHubModel.findById(id)));
    const hubById = new Map(hubs.filter(Boolean).map((h) => [h.id, h]));

    const occurrenceLists = await Promise.all([...classById.keys()].map((id) => occurrencesFor(id)));
    const occurrencesByClass = new Map([...classById.keys()].map((id, i) => [id, occurrenceLists[i]]));

    const adminIds = [...new Set([...hubById.values()].map((h) => h.ownerAdminId).filter(Boolean))];
    const settingsList = await Promise.all(adminIds.map((id) => ClaimSettingsModel.get(id)));
    const settingsByAdmin = new Map(adminIds.map((id, i) => [id, settingsList[i]]));

    const rows = [];
    for (const link of links) {
      const cls = classById.get(link.classId);
      const course = courseById.get(link.courseId);
      if (!cls || !course) continue;
      const hub = hubById.get(cls.schoolId) || null;
      const settings = settingsByAdmin.get(hub?.ownerAdminId) || { ...ClaimSettingsModel.DEFAULTS };
      const courseClaims = claims.filter((c) => c.classId === cls.id && c.courseId === course.id);
      const figures = buildFigures({
        teacher,
        course,
        sessions: allSessions.filter((s) => s.courseId === course.id),
        occurrences: occurrencesByClass.get(cls.id) || [],
        slots: allSlots.filter((s) => s.classId === cls.id),
        settings,
        claims: courseClaims,
      });
      rows.push({
        ...describeCourse({ link, cls, course, hub }),
        ...figures,
        latestClaim: courseClaims[0] ? { id: courseClaims[0].id, type: courseClaims[0].type, status: courseClaims[0].status, amount: courseClaims[0].amount } : null,
      });
    }

    const live = claims.filter((c) => c.status !== "rejected");
    const sum = (list) => list.reduce((total, c) => total + c.amount, 0);
    const paid = live.filter((c) => c.status === "paid");
    return {
      currency: rows[0]?.currency || ClaimSettingsModel.DEFAULTS.currency,
      summary: {
        courses: rows.length,
        totalValue: rows.reduce((total, r) => total + r.courseAmount, 0),
        earned: rows.reduce((total, r) => total + r.earnedAmount, 0),
        inReview: sum(live.filter((c) => PENDING.includes(c.status))),
        inReviewCount: live.filter((c) => PENDING.includes(c.status)).length,
        awaitingPayment: sum(live.filter((c) => c.status === "approved")),
        awaitingPaymentCount: live.filter((c) => c.status === "approved").length,
        paid: sum(paid),
        paidCount: paid.length,
        advancePaid: sum(paid.filter((c) => c.type === "advance")),
        hours: Math.round(rows.reduce((total, r) => total + r.hours, 0) * 10) / 10,
        sessionsDelivered: rows.reduce((total, r) => total + r.sessionsDelivered, 0),
      },
      courses: rows,
    };
  },

  // One course in full: its figures, and for every session each learner's attendance, whether
  // their assignment was graded and whether their report is done — the record behind the claim.
  // `requireLink` is off for a reviewer, who may be reading a claim whose educator has since
  // been moved off the course.
  async getCourseDetail({ teacherId, classId, courseId, requireLink = true }) {
    const teacher = await TeacherModel.findById(teacherId);
    const links = await ClassCourseTeacherLinkModel.findByClassAndCourse(classId, courseId);
    const link = links.find((l) => l.teacherId === teacherId) || null;
    if (requireLink && (!teacher || !link)) fail("You aren't assigned to this course", 404);

    const context = await loadCourseContext(classId, courseId);
    if (!context) fail("This course or class no longer exists", 404);
    const { cls, course, hub } = context;

    const [sessions, occurrences, slots, settings, claims, readiness, attendance, anchors] = await Promise.all([
      SessionModel.findByCourseId(courseId),
      occurrencesFor(classId),
      TimetableModel.findAll({ classId }),
      ClaimSettingsModel.get(hub?.ownerAdminId),
      ClaimModel.findAll({ teacherId, classId, courseId }),
      ReportService.getReadinessForClassCourse(classId, courseId),
      AttendanceModel.findAll({ classId }),
      CourseScheduleModel.findByClassId(classId),
    ]);

    const figures = buildFigures({ teacher, course, sessions, occurrences, slots, settings, claims });
    const today = todayStr();

    // Where each session that hasn't happened yet is due to fall.
    const plannedDate = new Map();
    const anchor = anchors.find((a) => a.courseId === courseId);
    if (anchor) {
      try {
        const to = new Date(Date.now() + 400 * DAY_MS).toISOString().slice(0, 10);
        const { events } = await resolveCalendar({ classId, from: anchor.startDate, to });
        for (const e of events) if (e.courseId === courseId && !plannedDate.has(e.sessionId)) plannedDate.set(e.sessionId, e.date);
      } catch (err) {
        console.error(`[claims] could not resolve the calendar for class ${classId}:`, err.message);
      }
    }

    const attendanceByDate = new Map();
    for (const row of attendance) {
      if (!attendanceByDate.has(row.date)) attendanceByDate.set(row.date, new Map());
      attendanceByDate.get(row.date).set(row.learnerId, row.status);
    }

    const learners = readiness
      .map((row) => ({ id: row.learner.id, firstName: row.learner.firstName, lastName: row.learner.lastName, photo: row.learner.photo || null }))
      .sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`));
    const readinessByLearner = new Map(readiness.map((row) => [row.learner.id, new Map(row.sessions.map((s) => [s.sessionId, s]))]));

    const totals = { attendanceMarked: 0, assignmentsGraded: 0, assignmentsExpected: 0, reportsDone: 0, reportsExpected: 0 };

    const sessionRows = sessions.map((session, index) => {
      const own = occurrences.filter((o) => o.courseId === courseId && o.sessionId === session.id && o.date <= today);
      const occurrence = own.find((o) => o.status !== "cancelled") || own[0] || null;
      let state = "unscheduled";
      if (occurrence) state = occurrence.status === "cancelled" ? "cancelled" : "delivered";
      else if (plannedDate.has(session.id)) state = "upcoming";
      const date = occurrence?.date || plannedDate.get(session.id) || null;
      const marks = state === "delivered" ? attendanceByDate.get(date) || new Map() : new Map();
      const attendanceMarked = marks.size > 0;

      const rows = learners.map((learner) => {
        const work = readinessByLearner.get(learner.id)?.get(session.id);
        const required = work?.requiredCount || 0;
        const graded = work?.gradedCount || 0;
        let assignment = "none";
        if (required > 0) assignment = graded >= required ? "graded" : graded > 0 ? "partial" : "pending";
        let report = "none";
        if (required > 0) {
          if (work?.report?.status === "published") report = work.report.content?.notSubmitted ? "not_submitted" : "done";
          else report = "pending";
        }
        return {
          learnerId: learner.id,
          attendance: marks.get(learner.id) || null,
          assignment,
          gradedCount: graded,
          requiredCount: required,
          report,
          reportId: work?.report?.id || null,
        };
      });

      const withWork = rows.filter((r) => r.assignment !== "none");
      const graded = withWork.filter((r) => r.assignment === "graded").length;
      const reported = withWork.filter((r) => r.report === "done" || r.report === "not_submitted").length;
      const attended = rows.filter((r) => r.attendance === "present" || r.attendance === "late").length;
      if (state === "delivered") {
        if (attendanceMarked) totals.attendanceMarked += 1;
        totals.assignmentsGraded += graded;
        totals.assignmentsExpected += withWork.length;
        totals.reportsDone += reported;
        totals.reportsExpected += withWork.length;
      }

      return {
        id: session.id,
        number: index + 1,
        title: session.title || null,
        date,
        state,
        taught: occurrence?.status === "taught",
        attendanceMarked,
        attendanceLocked: occurrence?.attendanceState === "locked_not_marked",
        attendancePercent: attendanceMarked ? percent(attended, rows.length) : null,
        assignmentPercent: percent(graded, withWork.length),
        reportPercent: percent(reported, withWork.length),
        learners: rows,
      };
    });

    const coEducatorIds = links.filter((l) => l.teacherId !== teacherId).map((l) => l.teacherId);
    const coEducators = coEducatorIds.length ? (await TeacherModel.findAll({ ids: coEducatorIds })).map((t) => teacherName(t)) : [];

    return {
      ...describeCourse({ link, cls, course, hub }),
      ...figures,
      ownerAdminId: hub?.ownerAdminId || null,
      teacher: teacher ? { id: teacher.id, name: teacherName(teacher), photo: teacher.photo || null } : null,
      // Who a claim submitted now would go to; null = straight to the admin.
      supervisor: await supervisorOf(teacher),
      coEducators,
      learners,
      sessions: sessionRows,
      evidence: {
        learners: learners.length,
        sessionsTotal: figures.sessionsTotal,
        sessionsDelivered: figures.sessionsDelivered,
        attendanceMarked: totals.attendanceMarked,
        assignmentsGraded: totals.assignmentsGraded,
        assignmentsExpected: totals.assignmentsExpected,
        reportsDone: totals.reportsDone,
        reportsExpected: totals.reportsExpected,
      },
      claims,
    };
  },

  async submitClaim(teacher, { classId, courseId, type, invoiceUrl, invoiceFilename, note }) {
    const detail = await ClaimService.getCourseDetail({ teacherId: teacher.id, classId, courseId });
    if (!detail.ownerAdminId) fail("This class isn't attached to a workspace that can pay claims", 409);

    const blocked = type === "advance" ? detail.advanceBlocked : detail.fullBlocked;
    if (blocked) fail(blocked, 409);
    const amount = type === "advance" ? detail.advanceAmount : detail.balance;
    if (amount <= 0) fail("There is nothing to claim for this course yet", 409);

    const claim = await ClaimModel.create({
      ownerAdminId: detail.ownerAdminId,
      teacherId: teacher.id,
      classId,
      courseId,
      hubId: detail.hub?.id || null,
      claimNumber: `CLM-${todayStr().replace(/-/g, "")}-${crypto.randomBytes(2).toString("hex").toUpperCase()}`,
      teacherName: teacherName(teacher),
      courseName: detail.courseName,
      className: detail.className,
      hubName: detail.hub?.name || null,
      type,
      status: detail.supervisor ? "pending_supervisor" : "pending_admin",
      supervisorId: detail.supervisor?.id || null,
      supervisorName: detail.supervisor?.name || null,
      currency: detail.currency,
      sessionRate: detail.sessionRate,
      sessionsTotal: detail.sessionsTotal,
      sessionsDelivered: detail.sessionsDelivered,
      courseAmount: detail.courseAmount,
      advanceDeducted: type === "full" ? detail.advanceRequested : 0,
      amount,
      invoiceUrl,
      invoiceFilename: invoiceFilename || null,
      note: note || null,
      evidence: detail.evidence,
    });
    await ClaimNotifications.submitted(claim);
    return claim;
  },

  // An educator can take back a claim nobody has acted on yet (wrong invoice attached, say).
  async withdrawClaim(teacher, id) {
    const claim = await ClaimModel.findById(id);
    if (!claim || claim.teacherId !== teacher.id) fail("Claim not found", 404);
    if (!PENDING.includes(claim.status)) fail("This claim has already been reviewed and can't be withdrawn", 409);
    const removed = await ClaimModel.deleteIfStatus(id, claim.status);
    if (!removed) fail("This claim has already been reviewed and can't be withdrawn", 409);
    return { message: "Claim withdrawn" };
  },

  listMine(teacher) {
    return ClaimModel.findAll({ teacherId: teacher.id });
  },

  // --- The reviewers' side ------------------------------------------------------------------

  async listForWorkspace(ownerAdminId, { status, teacherId } = {}) {
    const all = await ClaimModel.findAll({ ownerAdminId, teacherId });
    const counts = { pending_supervisor: 0, pending_admin: 0, approved: 0, paid: 0, rejected: 0 };
    const amounts = { ...counts };
    for (const claim of all) {
      counts[claim.status] += 1;
      amounts[claim.status] += claim.amount;
    }
    return { claims: status ? all.filter((c) => c.status === status) : all, counts, amounts };
  },

  async getOwned(id, ownerAdminId) {
    const claim = await ClaimModel.findById(id);
    if (!claim || claim.ownerAdminId !== ownerAdminId) fail("Claim not found", 404);
    return claim;
  },

  // A supervisor's own claims — the ones sent to them, whatever became of them since — and the
  // educators they currently supervise (including any who haven't claimed yet).
  async listForSupervisor(supervisorId) {
    const claims = await ClaimModel.findAll({ supervisorId });
    const teachers = (await TeacherModel.findAll()).filter((t) => t.supervisorId === supervisorId);
    const educators = teachers
      .map((t) => ({ id: t.id, name: teacherName(t), email: t.email || null, photo: t.photo || null, status: t.status || "active" }))
      .sort((a, b) => a.name.localeCompare(b.name));
    const counts = { pending_supervisor: 0, pending_admin: 0, approved: 0, paid: 0, rejected: 0 };
    const amounts = { ...counts };
    for (const claim of claims) {
      counts[claim.status] += 1;
      amounts[claim.status] += claim.amount;
    }
    return { claims, counts, amounts, educators };
  },

  async getAssigned(id, supervisorId) {
    const claim = await ClaimModel.findById(id);
    if (!claim || claim.supervisorId !== supervisorId) fail("Claim not found", 404);
    return claim;
  },

  // A claim together with the course's records as they stand now. The course part is null when
  // the class or course has since been deleted — the claim itself still reads on its own.
  async withCourse(claim) {
    let course = null;
    try {
      course = await ClaimService.getCourseDetail({ teacherId: claim.teacherId, classId: claim.classId, courseId: claim.courseId, requireLink: false });
    } catch (err) {
      if (err.statusCode !== 404) throw err;
    }
    return { ...claim, course };
  },

  async actorOf(req) {
    const user = await UserModel.findById(req.user.id);
    return { id: req.user.id, name: user?.name || user?.email || "Staff" };
  },

  // The supervisor's decision: approved for the admin to pay, or back to the educator with the
  // reason. `claim` has already been checked as the caller's to decide (see claim.controller.js) —
  // the assigned supervisor, or the workspace stepping in for them.
  async supervisorDecision(claim, { decision, reason }, actor) {
    const { id } = claim;
    if (claim.status !== "pending_supervisor") fail("This claim isn't waiting for a supervisor's review", 409);
    // supervisorId stays the supervisor the claim was sent to; the name is whoever decided.
    const stamp = { supervisorName: actor.name, supervisorDecidedAt: new Date() };
    const updated = decision === "approve"
      ? await ClaimModel.transition(id, "pending_supervisor", { ...stamp, status: "approved" })
      : await ClaimModel.transition(id, "pending_supervisor", { ...stamp, status: "rejected", rejectedStage: "supervisor", rejectionReason: reason });
    if (!updated) fail("Someone else has just reviewed this claim", 409);
    if (decision === "approve") await ClaimNotifications.forwarded(updated);
    else await ClaimNotifications.rejected(updated);
    return updated;
  },

  // The admin's own approval — only for a claim from an educator with no supervisor.
  async adminDecision(id, ownerAdminId, { decision, reason }, actor) {
    const claim = await ClaimService.getOwned(id, ownerAdminId);
    if (claim.status !== "pending_admin") fail("This claim isn't waiting for the admin's approval", 409);
    const stamp = { adminId: actor.id, adminName: actor.name, adminDecidedAt: new Date() };
    const updated = decision === "approve"
      ? await ClaimModel.transition(id, "pending_admin", { ...stamp, status: "approved" })
      : await ClaimModel.transition(id, "pending_admin", { ...stamp, status: "rejected", rejectedStage: "admin", rejectionReason: reason });
    if (!updated) fail("Someone else has just reviewed this claim", 409);
    if (decision === "approve") await ClaimNotifications.approved(updated);
    else await ClaimNotifications.rejected(updated);
    return updated;
  },

  async markPaid(id, ownerAdminId, { paymentReference, paidAt }, actor) {
    const claim = await ClaimService.getOwned(id, ownerAdminId);
    if (claim.status !== "approved") fail("Only an approved claim can be marked as paid", 409);
    const updated = await ClaimModel.transition(id, "approved", {
      status: "paid",
      paidAt: paidAt ? new Date(paidAt) : new Date(),
      paidBy: actor.id,
      paymentReference: paymentReference || null,
    });
    if (!updated) fail("This claim has already been updated", 409);
    await ClaimNotifications.paid(updated);
    return updated;
  },

  // --- Rates --------------------------------------------------------------------------------

  getSettings(ownerAdminId) {
    return ClaimSettingsModel.get(ownerAdminId);
  },

  saveSettings(ownerAdminId, data) {
    return ClaimSettingsModel.save(ownerAdminId, data);
  },
};

module.exports = ClaimService;
