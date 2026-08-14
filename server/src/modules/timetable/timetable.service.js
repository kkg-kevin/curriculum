const TimetableModel = require("./timetable.model");
const CourseScheduleModel = require("./course-schedule.model");
const SessionSkipModel = require("./session-skip.model");
const RoomModel = require("../rooms/room.model");
const SessionModel = require("../courses/session.model");
const CourseModel = require("../courses/course.model");
const ClassModel = require("../classes/class.model");
const ClassCourseTeacherLinkModel = require("../classes/class-course-teacher-link.model");
const LearnerHubLinkModel = require("../learners/learner-hub-link.model");
const LearnerModel = require("../learners/learner.model");
const TeacherModel = require("../teachers/teacher.model");
const CurriculumModel = require("../curriculum/curriculum.model");
const ProgramModel = require("../programs/program.model");
const AcademicYearVersionModel = require("../curriculum/academic-years/academic-year-versions.model");
const AttendanceModel = require("../attendance/attendance.model");
const ReportService = require("../reports/report.service");
const { DAYS_OF_WEEK } = require("./timetable.validation");

function notFound(message) {
  const err = new Error(message);
  err.statusCode = 404;
  throw err;
}

function conflictError(message) {
  const err = new Error(message);
  err.statusCode = 409;
  throw err;
}

function timesOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

// A slot's teacherId is an optional override (see baseSlotSchema in timetable.validation.js) —
// when unset, the slot's actual teacher is whichever educator(s) are linked to that (classId,
// courseId) pair via class-course-teacher-link.model.js (same resolution TimetablePage.jsx's own
// resolveTeacherLabel and getSessionSummary already use). A slot can therefore imply more than
// one teacher (co-teachers) or none at all (course not yet assigned to anyone) — returns every
// id that actually counts as "teaching this slot" either way.
async function resolveEffectiveTeacherIds(classId, courseId, explicitTeacherId) {
  if (explicitTeacherId) return [explicitTeacherId];
  const links = await ClassCourseTeacherLinkModel.findByClassId(classId);
  return links.filter((l) => l.courseId === courseId).map((l) => l.teacherId);
}

// A slot conflicts with another already on the same day if their times overlap AND either the
// class is shared (same class can't be in two places at once) or the *effective* teacher is
// shared — resolved via resolveEffectiveTeacherIds above, not just a raw teacherId match, since
// most slots identify their teacher through the course assignment rather than an explicit
// per-slot override. Two different classes/teachers can otherwise happily share a time slot.
// excludeId skips the slot being updated so re-saving one's own unchanged time doesn't collide
// with itself.
async function hasConflict({ classId, courseId, teacherId, roomId, dayOfWeek, startTime, endTime, excludeId }) {
  const all = await TimetableModel.findAll({ dayOfWeek });
  const overlapping = all.filter((s) => s.id !== excludeId && timesOverlap(startTime, endTime, s.startTime, s.endTime));
  if (overlapping.some((s) => s.classId === classId)) return true;
  // A room is one physical resource — any two overlapping slots sharing it conflict regardless
  // of class/teacher, unlike the teacher check below which only fires when the *same person*
  // would be double-booked.
  if (roomId && overlapping.some((s) => s.roomId === roomId)) return true;

  const myTeacherIds = await resolveEffectiveTeacherIds(classId, courseId, teacherId);
  if (myTeacherIds.length === 0) return false;

  const others = overlapping.filter((s) => s.classId !== classId);
  for (const s of others) {
    const otherTeacherIds = await resolveEffectiveTeacherIds(s.classId, s.courseId, s.teacherId);
    if (otherTeacherIds.some((id) => myTeacherIds.includes(id))) return true;
  }
  return false;
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const WEEKDAY_BY_INDEX = { 0: "sunday", 1: "monday", 2: "tuesday", 3: "wednesday", 4: "thursday", 5: "friday", 6: "saturday" };

// All date math below treats "YYYY-MM-DD" as a plain calendar date, walked in UTC so it can never
// drift a day off depending on the server's local timezone.
function toUtcMs(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}
function fromUtcMs(ms) {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}
function weekdayOf(dateStr) {
  return WEEKDAY_BY_INDEX[new Date(toUtcMs(dateStr)).getUTCDay()];
}

// A class's academic-calendar terms/breaks are resolved fresh on every read rather than cached
// or duplicated anywhere, same "nothing persisted" approach as the rest of this engine — so
// scheduling always reflects whatever the two date sources below currently say, with nothing to
// keep in sync. `curriculum.periods` itself never enters into this: it only ever holds period
// *names* (set on the curriculum's Structure step, used to scaffold the course-structure content
// by period) and never gets real dates written onto it by anything in the app.
//
// - A Program curriculum never has (or can have — Academic Year setup is hidden for it, see
//   CurriculumViewPage) dated periods of its own: it runs on the fixed startDate/endDate set on
//   its Program deployment instead of an academic-year cycle. So for those, the deployment's own
//   dates stand in as a single implicit period.
// - Every other curriculum's real period dates+breaks live on whichever Academic Year version is
//   currently published for it (see academic-years.service.js) — that's the one and only source
//   with actual dates a school ever fills in.
// Missing class/curriculum, a Program with no deployment yet, or a curriculum with no published
// Academic Year, all degrade to [] (unrestricted — see isDateSchedulable) rather than blocking
// scheduling outright — dates are opt-in constraints, not a prerequisite for having a timetable.
async function getPeriodsForClass(classId) {
  const cls = await ClassModel.findById(classId);
  if (!cls?.curriculumId) return [];
  const curriculum = await CurriculumModel.findById(cls.curriculumId);
  if (!curriculum) return [];
  if (curriculum.isProgram) {
    const program = await ProgramModel.findByClassId(classId);
    if (!program?.startDate || !program?.endDate) return [];
    return [{ name: curriculum.name, startDate: program.startDate, endDate: program.endDate, breakStartDate: "", breakEndDate: "" }];
  }
  const publishedVersion = await AcademicYearVersionModel.findPublished(curriculum.id);
  return publishedVersion?.periods || [];
}

// A date only counts as in-session if it falls inside some period's [startDate, endDate] and
// outside that period's own break window. Curricula that haven't configured periods yet (still
// common — this is opt-in, not required) impose no restriction at all, preserving the engine's
// original unrestricted behavior. A date not covered by ANY period — before/after the
// curriculum's span, or an unconfigured gap between two periods — is treated as not schedulable,
// same as an explicit break.
function isDateSchedulable(date, periods) {
  if (!periods.length) return true;
  const ms = toUtcMs(date);
  return periods.some((p) => {
    if (!p.startDate || !p.endDate) return false;
    if (ms < toUtcMs(p.startDate) || ms > toUtcMs(p.endDate)) return false;
    if (p.breakStartDate && p.breakEndDate && ms >= toUtcMs(p.breakStartDate) && ms <= toUtcMs(p.breakEndDate)) {
      return false;
    }
    return true;
  });
}

// Walks a single (classId, courseId) pair's Sessions onto the calendar: starting at its
// start-date anchor, every date whose weekday matches one of that course's configured slot
// weekdays AND falls within the curriculum's term calendar (not a break, not outside any period)
// consumes the next Session in order. A non-schedulable date is skipped outright — the cursor
// doesn't advance — so the Session that would have landed there simply lands on the next valid
// occurrence instead: scheduling pauses through a break and resumes right after. Nothing is
// persisted — this is recomputed from the anchor + current slots + current Sessions + current
// curriculum periods on every call, so editing any of those inputs is reflected immediately with
// no sync/migration code.
//
// skipsByDate ("YYYY-MM-DD" -> skip row) layers a teacher's one-off "we didn't hold this one" on
// top of the same mechanism: a "shift" skip behaves exactly like a break on that single date —
// continue without consuming, so the session that would have landed there cascades onto the next
// valid occurrence, same as scheduling already pauses through a break. A "merge" skip instead
// consumes the session but stashes it in pendingMerge rather than emitting it, so the very next
// valid occurrence emits it alongside whatever would normally land there (both get merged:true) —
// everything after that stays on its normal computed date, since only ONE date absorbed the
// extra session. pendingMerge is an array (not a flag) so consecutive skips of mixed mode compose
// correctly with no special-casing; the loop condition includes `|| pendingMerge.length` so a
// merge stashed on the course's very last session still gets a chance to flush instead of the
// walk terminating (cursor === sessions.length) before ever placing it.
async function resolveCoursePlacements({ classId, courseId, slotsByDay, startDate, from, to, periods, skipsByDate = {}, roomNameById = new Map() }) {
  const sessions = await SessionModel.findByCourseId(courseId);
  if (sessions.length === 0) return [];
  const events = [];
  let cursor = 0;
  let pendingMerge = [];
  const walkStart = toUtcMs(startDate) > toUtcMs(from) ? startDate : from;
  // The cursor must still advance through every occurrence from the anchor date onward, even
  // ones before `from`, so a session's position on the calendar doesn't depend on which range
  // happens to be requested — only walk from `from` when it's already past the anchor.
  for (let ms = toUtcMs(startDate); ms <= toUtcMs(to) && (cursor < sessions.length || pendingMerge.length); ms += ONE_DAY_MS) {
    const date = fromUtcMs(ms);
    const day = weekdayOf(date);
    const slot = slotsByDay[day];
    if (!slot) continue;
    if (!isDateSchedulable(date, periods)) continue;

    const skip = skipsByDate[date];
    if (skip && skip.mode === "shift" && cursor < sessions.length) continue;
    if (skip && skip.mode === "merge" && cursor < sessions.length) {
      pendingMerge.push(sessions[cursor]);
      cursor += 1;
      continue;
    }

    const toEmit = cursor < sessions.length ? [...pendingMerge, sessions[cursor]] : [...pendingMerge];
    if (cursor < sessions.length) cursor += 1;
    pendingMerge = [];
    if (toEmit.length === 0) continue;
    if (toUtcMs(date) < toUtcMs(walkStart)) continue;

    for (const session of toEmit) {
      events.push({
        date, dayOfWeek: day, classId, courseId,
        sessionId: session.id, sessionTitle: session.title, sessionOrder: session.order,
        teacherId: slot.teacherId || null, startTime: slot.startTime, endTime: slot.endTime, room: roomNameById.get(slot.roomId) || "",
        merged: toEmit.length > 1,
      });
    }
  }
  return events;
}

// Break windows (from periods that have one set) overlapping [from, to] — surfaced separately
// from events so the calendar UI can shade/label them even on days with no session at all.
// classIds tags which class this break actually belongs to — a break is a property of a whole
// curriculum/program (every class within it shares the exact same dates), but a merged teacher/
// learner calendar (see resolveTeacherCalendar/resolveLearnerCalendar) can span several different
// curricula at once, each with its own independent calendar. Without this tag the UI has no way
// to tell "every class is on break today" apart from "only some of the classes I'm looking at
// are" — see dedupeBreaks below for how these get merged across classes.
function breaksInRange(periods, from, to, classId) {
  const fromMs = toUtcMs(from);
  const toMs = toUtcMs(to);
  return periods
    .filter((p) => p.breakStartDate && p.breakEndDate)
    .filter((p) => toUtcMs(p.breakStartDate) <= toMs && toUtcMs(p.breakEndDate) >= fromMs)
    .map((p) => ({ start: p.breakStartDate, end: p.breakEndDate, label: p.name ? `${p.name} Break` : "Break", classIds: [classId] }));
}

// Two classes on the same curriculum produce identical {start,end,label} breaks — those merge
// into one entry with both classIds, rather than the dedupe silently keeping only the last one
// seen and losing track of who else it applies to.
function dedupeBreaks(breaks) {
  const seen = new Map();
  for (const b of breaks) {
    const key = `${b.start}:${b.end}:${b.label}`;
    const existing = seen.get(key);
    if (existing) existing.classIds = [...new Set([...existing.classIds, ...b.classIds])];
    else seen.set(key, { ...b, classIds: [...b.classIds] });
  }
  return [...seen.values()];
}

// Groups one class's skip rows by courseId -> {date: skipRow}, mirroring resolveCalendar's own
// slotsByCourse grouping — one query per class (see SessionSkipModel.findByClassId), reused both
// by the per-course walk (needs the full, unscoped set for cursor correctness — same reasoning
// resolveCoursePlacements already applies to periods/anchors) and by skippedSessionsInRange below.
function groupSkipsByCourse(skipRows) {
  const byCourse = {};
  for (const s of skipRows) {
    byCourse[s.courseId] = byCourse[s.courseId] || {};
    byCourse[s.courseId][s.date] = s;
  }
  return byCourse;
}

// Skip rows within [from, to] — surfaced separately from events for the same reason breaks are
// (see breaksInRange above): so the UI can mark a date that would otherwise look like the class
// silently vanished with no explanation. Unlike the unscoped skipsByDate map fed into the
// resolver's own walk, this is deliberately range-filtered, same relationship breaksInRange has
// to periods.
function skippedSessionsInRange(skipRows, from, to) {
  const fromMs = toUtcMs(from);
  const toMs = toUtcMs(to);
  return skipRows
    .filter((s) => { const ms = toUtcMs(s.date); return ms >= fromMs && ms <= toMs; })
    .map((s) => ({ id: s.id, classId: s.classId, courseId: s.courseId, date: s.date, sessionId: s.sessionId, mode: s.mode, reason: s.reason || "" }));
}

const TimetableService = {
  async listForClass(classId) {
    return TimetableModel.findAll({ classId });
  },

  async listCourseSchedules(classId) {
    return CourseScheduleModel.findByClassId(classId);
  },

  async setCourseSchedule(classId, courseId, startDate) {
    return CourseScheduleModel.setSchedule(classId, courseId, startDate);
  },

  // The read-time scheduling engine: every configured course for this class, walked onto real
  // dates between `from` and `to`. Courses with slots but no start-date anchor yet are silently
  // excluded — the UI is responsible for prompting the school to set one. Also returns this
  // class's curriculum break windows overlapping the range, so the UI can explain empty days.
  async resolveCalendar({ classId, from, to }) {
    const slots = await TimetableModel.findAll({ classId });
    const slotsByCourse = {};
    for (const slot of slots) {
      if (!DAYS_OF_WEEK.includes(slot.dayOfWeek)) continue;
      slotsByCourse[slot.courseId] = slotsByCourse[slot.courseId] || {};
      // If a course somehow has more than one slot on the same weekday, the earliest start time
      // wins — TimetableModel.findAll already returns slots sorted by startTime.
      if (!slotsByCourse[slot.courseId][slot.dayOfWeek]) slotsByCourse[slot.courseId][slot.dayOfWeek] = slot;
    }

    const periods = await getPeriodsForClass(classId);
    const anchors = await CourseScheduleModel.findByClassId(classId);
    const skipRows = await SessionSkipModel.findByClassId(classId);
    const skipsByCourse = groupSkipsByCourse(skipRows);
    // Resolved server-side so the emitted event shape (room: <string>) stays exactly what
    // CalendarView.jsx already renders — the client never needs to know about roomId at all.
    const roomIds = [...new Set(slots.map((s) => s.roomId).filter(Boolean))];
    const rooms = roomIds.length ? await RoomModel.findAll({ ids: roomIds }) : [];
    const roomNameById = new Map(rooms.map((r) => [r.id, r.name]));
    const eventLists = await Promise.all(anchors.map((anchor) => {
      const slotsByDay = slotsByCourse[anchor.courseId];
      if (!slotsByDay) return [];
      return resolveCoursePlacements({
        classId, courseId: anchor.courseId, slotsByDay, startDate: anchor.startDate, from, to, periods,
        skipsByDate: skipsByCourse[anchor.courseId] || {}, roomNameById,
      });
    }));
    const events = eventLists.flat();
    return {
      events: events.sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime)),
      breaks: breaksInRange(periods, from, to, classId),
      skippedSessions: skippedSessionsInRange(skipRows, from, to),
    };
  },

  // Same class-resolution as listForTeacher, but returning calendar events instead of slots.
  // Classes can sit on different curricula (different term calendars), so breaks are merged
  // across every linked class rather than assumed to be one shared calendar.
  async resolveTeacherCalendar(teacherId, from, to) {
    const links = await ClassCourseTeacherLinkModel.findByTeacherId(teacherId);
    const pairKey = (classId, courseId) => `${classId}:${courseId}`;
    const linkedPairs = new Set(links.map((l) => pairKey(l.classId, l.courseId)));
    const classIds = [...new Set(links.map((l) => l.classId))];
    const results = await Promise.all(classIds.map((classId) => TimetableService.resolveCalendar({ classId, from, to })));
    const events = results
      .flatMap((r) => r.events)
      .filter((e) => linkedPairs.has(pairKey(e.classId, e.courseId)))
      .filter((e) => !e.teacherId || e.teacherId === teacherId);
    return { events, breaks: dedupeBreaks(results.flatMap((r) => r.breaks)), skippedSessions: results.flatMap((r) => r.skippedSessions) };
  },

  // Same class-resolution as listForLearner, but returning calendar events instead of slots.
  async resolveLearnerCalendar(learnerId, from, to) {
    const links = await LearnerHubLinkModel.findByLearnerId(learnerId);
    const classIds = links.filter((l) => l.classId && l.status === "active").map((l) => l.classId);
    const results = await Promise.all(classIds.map((classId) => TimetableService.resolveCalendar({ classId, from, to })));
    return { events: results.flatMap((r) => r.events), breaks: dedupeBreaks(results.flatMap((r) => r.breaks)), skippedSessions: results.flatMap((r) => r.skippedSessions) };
  },

  // Same merge pattern as resolveTeacherCalendar/resolveLearnerCalendar above, scoped to every
  // class at one Learning Hub instead of one person's linked classes — the school-portal's
  // "All Classes" view.
  async resolveHubCalendar(hubId, from, to) {
    const classes = await ClassModel.findAll({ schoolId: hubId });
    const classIds = classes.map((c) => c.id);
    const results = await Promise.all(classIds.map((classId) => TimetableService.resolveCalendar({ classId, from, to })));
    return { events: results.flatMap((r) => r.events), breaks: dedupeBreaks(results.flatMap((r) => r.breaks)), skippedSessions: results.flatMap((r) => r.skippedSessions) };
  },

  // Every slot belonging to a (classId, courseId) pair this teacher is actually linked to (see
  // class-course-teacher-link.model.js) — a slot with no teacherId override is implied to be
  // taught by whichever educator(s) are linked to that course in that class, not just the
  // primary, so every co-teacher sees it on their own timetable too.
  async listForTeacher(teacherId) {
    const links = await ClassCourseTeacherLinkModel.findByTeacherId(teacherId);
    const pairKey = (classId, courseId) => `${classId}:${courseId}`;
    const linkedPairs = new Set(links.map((l) => pairKey(l.classId, l.courseId)));
    const all = await TimetableModel.findAll();
    return all
      .filter((s) => linkedPairs.has(pairKey(s.classId, s.courseId)))
      .filter((s) => !s.teacherId || s.teacherId === teacherId);
  },

  // Every slot for every class this learner is currently actively enrolled in — a learner can
  // be enrolled at more than one hub/class at once (see learner-hub-link.model.js).
  async listForLearner(learnerId) {
    const links = await LearnerHubLinkModel.findByLearnerId(learnerId);
    const classIds = links.filter((l) => l.classId && l.status === "active").map((l) => l.classId);
    const all = await TimetableModel.findAll();
    return all.filter((s) => classIds.includes(s.classId));
  },

  async createSlot(data) {
    if (await hasConflict(data)) {
      conflictError("This time overlaps with an existing slot for this class, teacher, or room");
    }
    return TimetableModel.create(data);
  },

  async updateSlot(id, data) {
    const existing = await TimetableModel.findById(id);
    if (!existing) notFound("Timetable slot not found");
    const merged = { ...existing, ...data };
    if (await hasConflict({ ...merged, excludeId: id })) {
      conflictError("This time overlaps with an existing slot for this class, teacher, or room");
    }
    return TimetableModel.update(id, data);
  },

  async deleteSlot(id) {
    const deleted = await TimetableModel.delete(id);
    if (!deleted) notFound("Timetable slot not found");
    return { message: "Timetable slot deleted" };
  },

  // A teacher's "we didn't hold this one" record — see resolveCoursePlacements for how mode
  // plugs into the calendar walk. Pre-checked (not caught as a DB duplicate-key error), same
  // "app-level pre-check" convention every other uniqueness guard in this codebase already uses
  // (e.g. class.service.js's assertStreamAvailable). Merge structurally needs a following
  // occurrence to attach to, so it's rejected outright on a course's actual last session rather
  // than silently degrading to shift-like behavior at write time.
  async createSkip({ classId, courseId, date, sessionId, mode, reason, createdBy }) {
    const existing = await SessionSkipModel.findOne(classId, courseId, date);
    if (existing) conflictError("This session has already been rescheduled.");
    if (mode === "merge") {
      const courseSessions = await SessionModel.findByCourseId(courseId);
      const isLast = courseSessions[courseSessions.length - 1]?.id === sessionId;
      if (isLast) conflictError("This is the final session in the course — there's no next session to merge it with. Use \"Move all future sessions forward\" instead.");
    }
    return SessionSkipModel.create({ classId, courseId, date, sessionId, mode, reason: reason || "", createdBy: createdBy || null });
  },

  async deleteSkip(id) {
    const deleted = await SessionSkipModel.delete(id);
    if (!deleted) notFound("Reschedule record not found");
    return { message: "Reschedule undone" };
  },

  async listSkips(classId) {
    return SessionSkipModel.findByClassId(classId);
  },

  // "What happened in this session" — the click-through detail behind a single calendar event.
  // classId+date (not just sessionId) are required because the same session can land on
  // different real dates in different classes running the same course; attendance in particular
  // is keyed by exactly that pair (see attendance.model.js). Resolved fresh from Attendance +
  // Reports on every call, same "nothing persisted, nothing cached" posture as the rest of this
  // engine — a session viewed again after attendance is marked or grading finishes just reflects
  // the current state, no invalidation needed.
  async getSessionSummary({ classId, sessionId, date }) {
    const session = await SessionModel.findById(sessionId);
    if (!session) notFound("Session not found");
    const cls = await ClassModel.findById(classId);
    if (!cls) notFound("Class not found");
    const course = await CourseModel.findById(session.courseId);
    const courseSessions = await SessionModel.findByCourseId(session.courseId);
    const totalSessions = courseSessions.length;

    // Same teacher-resolution order as TimetablePage.jsx's resolveTeacherLabel: an explicit
    // override on that day's slot wins, otherwise whichever educator is primary for this course
    // in this class.
    const dayOfWeek = weekdayOf(date);
    const classSlots = await TimetableModel.findAll({ classId });
    const slot = classSlots.find((s) => s.courseId === session.courseId && s.dayOfWeek === dayOfWeek);
    const allCourseLinks = await ClassCourseTeacherLinkModel.findByClassId(classId);
    const courseLinks = allCourseLinks.filter((l) => l.courseId === session.courseId);
    const primaryLink = courseLinks.find((l) => l.isPrimary) || courseLinks[0] || null;
    const teacherId = slot?.teacherId || primaryLink?.teacherId || null;
    const teacher = teacherId ? await TeacherModel.findById(teacherId) : null;

    // Attendance is recorded per classId+date, not per course/session — a class only ever runs
    // one session on a given date in practice, so this date's attendance IS this session's
    // attendance (see attendance.model.js's own key).
    const allLinks = await LearnerHubLinkModel.findByClassId(classId);
    const enrolledLinks = allLinks.filter((l) => l.status === "active");
    const learners = await LearnerModel.findAll({ ids: enrolledLinks.map((l) => l.learnerId) });
    const learnersById = new Map(learners.map((l) => [l.id, l]));
    const attendanceRecords = await AttendanceModel.findByClassAndDate(classId, date);
    const counts = { present: 0, absent: 0, late: 0, excused: 0 };
    const records = attendanceRecords.map((a) => {
      if (counts[a.status] !== undefined) counts[a.status] += 1;
      return { learnerId: a.learnerId, learner: learnersById.get(a.learnerId) || null, status: a.status, notes: a.notes || "" };
    });

    return {
      session: { id: session.id, title: session.title, order: session.order, totalSessions },
      course: course ? { id: course.id, name: course.name } : null,
      class: { id: cls.id, gradeName: cls.gradeName, streamName: cls.streamName || "" },
      date,
      teacher: teacher ? { id: teacher.id, name: `${teacher.firstName} ${teacher.lastName}` } : null,
      attendance: {
        marked: attendanceRecords.length > 0,
        enrolledCount: enrolledLinks.length,
        counts,
        records,
      },
      grading: await ReportService.getSessionSummaryForClass(classId, sessionId),
    };
  },

  // Lightweight sibling of getSessionSummary, for the calendar's at-a-glance status badges — one
  // call for every visible event's (classId, sessionId, date) triple instead of a full-detail
  // fetch (with learner rosters) per card. Same underlying numbers as getSessionSummary's
  // attendance/grading blocks, just counts instead of per-learner rows, and silently skips a
  // triple whose session no longer exists rather than erroring out the whole batch over one
  // stale card.
  async getSessionStatusBulk(occurrences) {
    const result = {};
    for (const { classId, sessionId, date } of occurrences) {
      const session = await SessionModel.findById(sessionId);
      if (!session) continue;
      const links = await LearnerHubLinkModel.findByClassId(classId);
      const enrolledCount = links.filter((l) => l.status === "active").length;
      const attendanceRecords = await AttendanceModel.findByClassAndDate(classId, date);
      const presentCount = attendanceRecords.filter((a) => a.status === "present").length;
      const grading = await ReportService.getSessionSummaryForClass(classId, sessionId);
      result[`${classId}-${sessionId}-${date}`] = {
        attendanceMarked: attendanceRecords.length > 0,
        attendancePercent: enrolledCount > 0 ? Math.round((presentCount / enrolledCount) * 100) : null,
        gradingRequired: grading.requiredCount > 0,
        gradingComplete: grading.requiredCount > 0 && grading.fullyGradedCount === grading.totalLearners,
        gradingPercent: grading.totalLearners > 0 ? Math.round((grading.fullyGradedCount / grading.totalLearners) * 100) : null,
      };
    }
    return result;
  },
};

module.exports = TimetableService;
