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
const TeacherHubLinkModel = require("../teachers/teacher-hub-link.model");
const UserModel = require("../auth/user.model");
const AttendanceModel = require("../attendance/attendance.model");
const TimetableModel = require("../timetable/timetable.model");
const CourseScheduleModel = require("../timetable/course-schedule.model");
const TimetableService = require("../timetable/timetable.service");
const SessionOccurrenceService = require("../timetable/session-occurrence.service");
const SessionOccurrenceModel = require("../timetable/session-occurrence.model");
const ReportService = require("../reports/report.service");
const LearnerHubLinkModel = require("../learners/learner-hub-link.model");

// Educator claims — how an educator gets paid for a course they teach.
//
// Only part-time educators claim (teachers.employmentType; full time is a tag only). A part-time
// educator is tagged with one or more ways of being paid (teachers.payRateTypes): per session,
// per hour, per day or "base plus", each at the workspace's rates (Settings → Educator pay —
// claim-settings.model.js). On each course they choose one; once a claim on that course is live,
// the course stays on that choice so an advance and the full payment add up.
//
//   session    a course's sessions
//   hourly     the hours taught — each delivered session's timetable slot on the day it ran; the
//              sessions still to come count at the course's usual slot length
//   daily      the days taught — the dates with a delivered session; the sessions still to come
//              count as days at the course's usual sessions per day
//   base_plus  a course's sessions, each paid the session rate (the base) plus the commission
//              for every learner enrolled in the class — e.g. KSh 500 + 12 learners × KSh 50 =
//              KSh 1,100 a session. The learners are counted when the figures are worked out
//              (and fixed on a claim when it is sent).
//
// A course's value is those units × the rate, rounded to a whole shilling. From that:
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

const RATE_TYPES = ["session", "hourly", "daily", "base_plus"];
const RATE_KEY = { session: "sessionRate", hourly: "hourlyRate", daily: "dailyRate" };
const RATE_NAME = { session: "session", hourly: "hourly", daily: "daily", base_plus: "Base plus" };
const RATE_PHRASE = { session: "per session", hourly: "by the hour", daily: "by the day", base_plus: "on Base plus" };

// Learners enrolled in each class (active links), for Base plus: { classId → count }.
async function enrolledCounts(classIds) {
  const links = await LearnerHubLinkModel.findByClassIds(classIds);
  const byClass = new Map();
  for (const link of links) {
    if (link.status !== "active" || !link.classId) continue;
    if (!byClass.has(link.classId)) byClass.set(link.classId, new Set());
    byClass.get(link.classId).add(link.learnerId);
  }
  return new Map(classIds.map((id) => [id, byClass.get(id)?.size || 0]));
}
const roundUnits = (value) => Math.round(value * 100) / 100;

function parseList(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

const isFullTime = (teacher) => teacher?.employmentType === "full_time";

// The ways this educator may be paid — their tags, in the usual order. An educator from before
// pay types existed has none stored and was paid per session.
function rateTypesOf(teacher) {
  const tagged = parseList(teacher?.payRateTypes).filter((t) => RATE_TYPES.includes(t));
  return tagged.length ? RATE_TYPES.filter((t) => tagged.includes(t)) : ["session"];
}

// Everything money-related about one (educator, class, course) on one way of paying: what the
// course is worth, what has been earned and requested so far, and what can be requested now.
function buildFigures({ course, sessions, occurrences, slots, settings, claims, rateType = "session", learnerCount = 0 }) {
  const today = todayStr();
  const sessionIds = new Set(sessions.map((s) => s.id));
  const past = occurrences.filter((o) => o.courseId === course.id && sessionIds.has(o.sessionId) && o.date <= today);
  const delivered = past.filter((o) => o.status !== "cancelled");
  const deliveredIds = new Set(delivered.map((o) => o.sessionId));
  // Cancelled and never made up on another date.
  const cancelledIds = new Set(past.filter((o) => o.status === "cancelled" && !deliveredIds.has(o.sessionId)).map((o) => o.sessionId));

  const sessionsTotal = sessions.length - cancelledIds.size;
  const sessionsDelivered = deliveredIds.size;
  const remainingSessions = Math.max(0, sessionsTotal - sessionsDelivered);

  // Time actually spent teaching: each delivered session's slot length on the day it ran.
  const courseSlots = slots.filter((s) => s.courseId === course.id);
  const hours = delivered.reduce((total, o) => {
    const slot = courseSlots.find((s) => s.dayOfWeek === weekdayOf(o.date)) || courseSlots[0];
    return total + (slot ? hoursBetween(slot.startTime, slot.endTime) : 0);
  }, 0);
  const slotHours = courseSlots.map((s) => hoursBetween(s.startTime, s.endTime)).filter((h) => h > 0);
  const hoursPerSession = slotHours.length ? slotHours.reduce((a, b) => a + b, 0) / slotHours.length : 0;
  // Days: one per date a session ran; sessions still to come at the course's usual number a day.
  const daysDelivered = new Set(delivered.map((o) => o.date)).size;
  const perWeekday = courseSlots.reduce((acc, s) => acc.set(s.dayOfWeek, (acc.get(s.dayOfWeek) || 0) + 1), new Map());
  const sessionsPerDay = Math.max(1, ...perWeekday.values());

  const units = {
    session: { total: sessionsTotal, delivered: sessionsDelivered },
    hourly: { total: roundUnits(hours + remainingSessions * hoursPerSession), delivered: roundUnits(hours) },
    daily: { total: daysDelivered + Math.ceil(remainingSessions / sessionsPerDay), delivered: daysDelivered },
    base_plus: { total: sessionsTotal, delivered: sessionsDelivered },
  }[rateType];
  // Base plus: a session pays the base (the session rate) plus the commission for each enrolled
  // learner. Both must be set for it to be offered.
  const basePlus = rateType === "base_plus";
  const baseRate = basePlus ? settings.sessionRate || null : null;
  const commissionRate = basePlus ? settings.commissionRate || null : null;
  const rate = basePlus
    ? (baseRate && commissionRate ? Math.round((baseRate + learnerCount * commissionRate) * 1000) / 1000 : null)
    : settings[RATE_KEY[rateType]] || null;
  const courseAmount = rate ? wholeShillings(units.total * rate) : 0;
  const earnedAmount = rate ? wholeShillings(units.delivered * rate) : 0;
  const advanceAmount = wholeShillings((courseAmount * settings.advancePercent) / 100);

  const live = claims.filter((c) => c.status !== "rejected");
  const advances = live.filter((c) => c.type === "advance");
  const fullClaim = live.find((c) => c.type === "full") || null;
  const sum = (rows) => rows.reduce((total, c) => total + c.amount, 0);
  const advanceRequested = sum(advances);
  const advancePaid = sum(advances.filter((c) => c.status === "paid"));
  const balance = Math.max(0, courseAmount - advanceRequested);
  const remaining = Math.max(0, sessionsTotal - sessionsDelivered);

  // Nothing can be claimed on a way of paying the workspace hasn't put a rate on, or on hours
  // when the timetable gives this course no times to count.
  let unpayable = null;
  if (basePlus && !baseRate) unpayable = "Base plus is paid on top of the session rate, which isn't set yet — ask the admin to set it in Settings → Educator pay.";
  else if (basePlus && !commissionRate) unpayable = "The Base plus commission per learner isn't set yet — ask the admin to set it in Settings → Educator pay.";
  else if (!rate) unpayable = `The ${RATE_NAME[rateType]} rate isn't set yet — ask the admin to set it in Settings → Educator pay.`;
  else if (rateType === "hourly" && sessionsTotal > 0 && units.total <= 0) unpayable = "The timetable has no start and end times for this course, so its hours can't be counted.";

  let advanceBlocked = null;
  if (unpayable) advanceBlocked = unpayable;
  else if (sessionsTotal === 0) advanceBlocked = "This course has no sessions yet.";
  else if (fullClaim) advanceBlocked = "The full payment has already been requested for this course.";
  else if (advances.length) advanceBlocked = "An advance has already been requested for this course.";
  else if (remaining === 0) advanceBlocked = "Every session is delivered — request the full payment instead.";

  let fullBlocked = null;
  if (unpayable) fullBlocked = unpayable;
  else if (sessionsTotal === 0) fullBlocked = "This course has no sessions yet.";
  else if (fullClaim) fullBlocked = "The full payment has already been requested for this course.";
  else if (advances.some((c) => PENDING.includes(c.status))) fullBlocked = "Your advance request is still being reviewed.";
  else if (remaining > 0) fullBlocked = `${remaining} ${remaining === 1 ? "session is" : "sessions are"} still to be delivered.`;
  else if (balance <= 0) fullBlocked = "Nothing is left to claim for this course.";

  let stage = "not_started";
  if (fullClaim?.status === "paid") stage = "paid";
  else if (fullClaim?.status === "approved") stage = "approved";
  else if (live.some((c) => PENDING.includes(c.status))) stage = "in_review";
  else if (!fullBlocked) stage = "ready";
  else if (sessionsDelivered > 0) stage = "in_progress";

  return {
    currency: settings.currency,
    rateType,
    rate,
    unitsTotal: units.total,
    unitsDelivered: units.delivered,
    // Kept for screens that still read the session-only names. For Base plus it's the base.
    sessionRate: basePlus ? baseRate : rate,
    // Base plus only: what each session's rate is made of.
    ...(basePlus ? { baseRate, commissionRate, learnerCount } : {}),
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

// The figures for every way this educator may be paid on this course, and the one to show first.
// A course with a live claim stays on that claim's way of paying.
function buildOptions({ teacher, course, sessions, occurrences, slots, settings, claims, learnerCount = 0 }) {
  const locked = claims.find((c) => c.status !== "rejected")?.rateType || null;
  const types = locked ? [locked] : rateTypesOf(teacher);
  const options = types.map((rateType) => buildFigures({ course, sessions, occurrences, slots, settings, claims, rateType, learnerCount }));
  // Show first the one that can be claimed on now, else the first.
  const primary = options.find((o) => o.canRequestFull || o.canRequestAdvance) || options[0];
  return { ...primary, rateLocked: Boolean(locked), rateOptions: options };
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
  // the totals across all of them. With `hubId`, only that hub's courses and claims (the portal's
  // hub picker — Home Learning is a hub too).
  async listMyCourses(teacher, { hubId } = {}) {
    // Full-time educators don't claim — the portal says so instead of listing courses.
    if (isFullTime(teacher)) {
      return { fullTime: true, currency: ClaimSettingsModel.DEFAULTS.currency, summary: null, courses: [] };
    }
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

    const learnersByClass = await enrolledCounts([...classById.keys()]);
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
      const figures = buildOptions({
        teacher,
        course,
        sessions: allSessions.filter((s) => s.courseId === course.id),
        occurrences: occurrencesByClass.get(cls.id) || [],
        slots: allSlots.filter((s) => s.classId === cls.id),
        settings,
        claims: courseClaims,
        learnerCount: learnersByClass.get(cls.id) || 0,
      });
      rows.push({
        ...describeCourse({ link, cls, course, hub }),
        ...figures,
        latestClaim: courseClaims[0] ? { id: courseClaims[0].id, type: courseClaims[0].type, status: courseClaims[0].status, amount: courseClaims[0].amount } : null,
      });
    }

    // A claim names its hub; one that doesn't goes by its class's.
    const claimHubId = (c) => c.hubId || classById.get(c.classId)?.schoolId || null;
    const shownRows = hubId ? rows.filter((r) => r.hub?.id === hubId) : rows;
    const shownClaims = hubId ? claims.filter((c) => claimHubId(c) === hubId) : claims;

    const live = shownClaims.filter((c) => c.status !== "rejected");
    const sum = (list) => list.reduce((total, c) => total + c.amount, 0);
    const paid = live.filter((c) => c.status === "paid");
    return {
      currency: shownRows[0]?.currency || rows[0]?.currency || ClaimSettingsModel.DEFAULTS.currency,
      summary: {
        courses: shownRows.length,
        totalValue: shownRows.reduce((total, r) => total + r.courseAmount, 0),
        earned: shownRows.reduce((total, r) => total + r.earnedAmount, 0),
        inReview: sum(live.filter((c) => PENDING.includes(c.status))),
        inReviewCount: live.filter((c) => PENDING.includes(c.status)).length,
        awaitingPayment: sum(live.filter((c) => c.status === "approved")),
        awaitingPaymentCount: live.filter((c) => c.status === "approved").length,
        paid: sum(paid),
        paidCount: paid.length,
        advancePaid: sum(paid.filter((c) => c.type === "advance")),
        hours: Math.round(shownRows.reduce((total, r) => total + r.hours, 0) * 10) / 10,
        sessionsDelivered: shownRows.reduce((total, r) => total + r.sessionsDelivered, 0),
      },
      courses: shownRows,
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

    const [sessions, occurrences, slots, settings, claims, readiness, attendance, anchors, learnersByClass] = await Promise.all([
      SessionModel.findByCourseId(courseId),
      occurrencesFor(classId),
      TimetableModel.findAll({ classId }),
      ClaimSettingsModel.get(hub?.ownerAdminId),
      ClaimModel.findAll({ teacherId, classId, courseId }),
      ReportService.getReadinessForClassCourse(classId, courseId),
      AttendanceModel.findAll({ classId }),
      CourseScheduleModel.findByClassId(classId),
      enrolledCounts([classId]),
    ]);

    const figures = buildOptions({ teacher, course, sessions, occurrences, slots, settings, claims, learnerCount: learnersByClass.get(classId) || 0 });
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
      teacher: teacher
        ? { id: teacher.id, name: teacherName(teacher), photo: teacher.photo || null, email: teacher.email || null, phone: teacher.phone || null, fullTime: isFullTime(teacher) }
        : null,
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

  async submitClaim(teacher, { classId, courseId, type, rateType = "session", invoiceUrl, invoiceFilename, note }) {
    if (isFullTime(teacher)) fail("Full-time educators don't claim payment for courses", 403);
    const detail = await ClaimService.getCourseDetail({ teacherId: teacher.id, classId, courseId });
    if (!detail.ownerAdminId) fail("This class isn't attached to a workspace that can pay claims", 409);

    // The way of paying they picked, as long as it's one of theirs (and the course's, once it
    // has a live claim).
    const figures = detail.rateOptions.find((o) => o.rateType === rateType);
    if (!figures) {
      fail(detail.rateLocked
        ? `This course is already being claimed ${RATE_PHRASE[detail.rateType] || "per session"}.`
        : "You can't claim this way — ask the admin which ways of paying apply to you.", 409);
    }
    const blocked = type === "advance" ? figures.advanceBlocked : figures.fullBlocked;
    if (blocked) fail(blocked, 409);
    const amount = type === "advance" ? figures.advanceAmount : figures.balance;
    if (amount <= 0) fail("There is nothing to claim for this course yet", 409);

    const claim = await ClaimModel.create({
      ownerAdminId: detail.ownerAdminId,
      teacherId: teacher.id,
      classId,
      courseId,
      hubId: detail.hub?.id || null,
      claimNumber: `CLM-${todayStr().replace(/-/g, "")}-${crypto.randomBytes(2).toString("hex").toUpperCase()}`,
      teacherName: teacherName(teacher),
      teacherEmail: teacher.email || null,
      teacherPhone: teacher.phone || null,
      courseName: detail.courseName,
      className: detail.className,
      hubName: detail.hub?.name || null,
      type,
      status: detail.supervisor ? "pending_supervisor" : "pending_admin",
      supervisorId: detail.supervisor?.id || null,
      supervisorName: detail.supervisor?.name || null,
      currency: figures.currency,
      rateType: figures.rateType,
      rate: figures.rate,
      unitsTotal: figures.unitsTotal,
      unitsDelivered: figures.unitsDelivered,
      sessionRate: figures.sessionRate,
      // Base plus: the learners and commission this claim was worked out on.
      learnerCount: figures.rateType === "base_plus" ? figures.learnerCount : null,
      commissionRate: figures.rateType === "base_plus" ? figures.commissionRate : null,
      sessionsTotal: figures.sessionsTotal,
      sessionsDelivered: figures.sessionsDelivered,
      courseAmount: figures.courseAmount,
      advanceDeducted: type === "full" ? figures.advanceRequested : 0,
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

    // The schools (hubs) each educator works at — linked to, or teaching a class at — so a
    // supervisor looking after many schools can narrow down to one and its educators.
    const schoolIdsByTeacher = new Map();
    await Promise.all(teachers.map(async (t) => {
      const [hubLinks, classLinks] = await Promise.all([TeacherHubLinkModel.findByTeacherId(t.id), ClassCourseTeacherLinkModel.findByTeacherId(t.id)]);
      const classes = await Promise.all([...new Set(classLinks.map((l) => l.classId))].map((id) => ClassModel.findById(id)));
      schoolIdsByTeacher.set(t.id, new Set([...hubLinks.map((l) => l.hubId), ...classes.map((c) => c?.schoolId)].filter(Boolean)));
    }));
    const schoolIds = [...new Set([...schoolIdsByTeacher.values()].flatMap((ids) => [...ids]))];
    const hubs = (await Promise.all(schoolIds.map((id) => LearningHubModel.findById(id)))).filter(Boolean);
    const schoolById = new Map(hubs.map((h) => [h.id, { id: h.id, name: h.name, isHomeLearning: Boolean(h.isHomeLearning) }]));
    // Home learning after the named schools.
    const bySchool = (a, b) => Number(a.isHomeLearning) - Number(b.isHomeLearning) || a.name.localeCompare(b.name);

    const educators = teachers
      .map((t) => ({
        id: t.id, name: teacherName(t), email: t.email || null, photo: t.photo || null, status: t.status || "active",
        schools: [...(schoolIdsByTeacher.get(t.id) || [])].map((id) => schoolById.get(id)).filter(Boolean).sort(bySchool),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
    const schools = [...schoolById.values()]
      .map((school) => ({ ...school, educators: educators.filter((e) => e.schools.some((s) => s.id === school.id)).length }))
      .sort(bySchool);
    const counts = { pending_supervisor: 0, pending_admin: 0, approved: 0, paid: 0, rejected: 0 };
    const amounts = { ...counts };
    for (const claim of claims) {
      counts[claim.status] += 1;
      amounts[claim.status] += claim.amount;
    }
    return { claims, counts, amounts, educators, schools };
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
module.exports._internal = { buildFigures, rateTypesOf };
