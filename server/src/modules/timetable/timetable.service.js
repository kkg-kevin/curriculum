const TimetableModel = require("./timetable.model");
const CourseScheduleModel = require("./course-schedule.model");
const SessionModel = require("../courses/session.model");
const ClassCourseTeacherLinkModel = require("../classes/class-course-teacher-link.model");
const LearnerHubLinkModel = require("../learners/learner-hub-link.model");
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

// A slot conflicts with another already on the same day if their times overlap AND either the
// class or the (non-null) teacher is shared — the same class can't be in two places at once,
// and neither can one teacher, but two different classes/teachers can happily share a time slot.
// excludeId skips the slot being updated so re-saving one's own unchanged time doesn't collide
// with itself.
function hasConflict({ classId, teacherId, dayOfWeek, startTime, endTime, excludeId }) {
  const daySlots = TimetableModel.findAll({ dayOfWeek }).filter((s) => s.id !== excludeId);
  return daySlots.some((s) => {
    if (!timesOverlap(startTime, endTime, s.startTime, s.endTime)) return false;
    if (s.classId === classId) return true;
    if (teacherId && s.teacherId === teacherId) return true;
    return false;
  });
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

// Walks a single (classId, courseId) pair's Sessions onto the calendar: starting at its
// start-date anchor, every date whose weekday matches one of that course's configured slot
// weekdays consumes the next Session in order. Nothing is persisted — this is recomputed from
// the anchor + current slots + current Sessions on every call, so editing any of those three
// inputs is reflected immediately with no sync/migration code.
function resolveCoursePlacements({ classId, courseId, slotsByDay, startDate, from, to }) {
  const sessions = SessionModel.findByCourseId(courseId);
  if (sessions.length === 0) return [];
  const events = [];
  let cursor = 0;
  const walkStart = toUtcMs(startDate) > toUtcMs(from) ? startDate : from;
  // The cursor must still advance through every occurrence from the anchor date onward, even
  // ones before `from`, so a session's position on the calendar doesn't depend on which range
  // happens to be requested — only walk from `from` when it's already past the anchor.
  for (let ms = toUtcMs(startDate); ms <= toUtcMs(to) && cursor < sessions.length; ms += ONE_DAY_MS) {
    const date = fromUtcMs(ms);
    const day = weekdayOf(date);
    const slot = slotsByDay[day];
    if (!slot) continue;
    const session = sessions[cursor];
    cursor += 1;
    if (toUtcMs(date) < toUtcMs(walkStart)) continue;
    events.push({
      date, dayOfWeek: day, classId, courseId,
      sessionId: session.id, sessionTitle: session.title, sessionOrder: session.order,
      teacherId: slot.teacherId || null, startTime: slot.startTime, endTime: slot.endTime, room: slot.room || "",
    });
  }
  return events;
}

const TimetableService = {
  listForClass(classId) {
    return TimetableModel.findAll({ classId });
  },

  listCourseSchedules(classId) {
    return CourseScheduleModel.findByClassId(classId);
  },

  setCourseSchedule(classId, courseId, startDate) {
    return CourseScheduleModel.setSchedule(classId, courseId, startDate);
  },

  // The read-time scheduling engine: every configured course for this class, walked onto real
  // dates between `from` and `to`. Courses with slots but no start-date anchor yet are silently
  // excluded — the UI is responsible for prompting the school to set one.
  resolveCalendar({ classId, from, to }) {
    const slots = TimetableModel.findAll({ classId });
    const slotsByCourse = {};
    for (const slot of slots) {
      if (!DAYS_OF_WEEK.includes(slot.dayOfWeek)) continue;
      slotsByCourse[slot.courseId] = slotsByCourse[slot.courseId] || {};
      // If a course somehow has more than one slot on the same weekday, the earliest start time
      // wins — TimetableModel.findAll already returns slots sorted by startTime.
      if (!slotsByCourse[slot.courseId][slot.dayOfWeek]) slotsByCourse[slot.courseId][slot.dayOfWeek] = slot;
    }

    const anchors = CourseScheduleModel.findByClassId(classId);
    const events = [];
    for (const anchor of anchors) {
      const slotsByDay = slotsByCourse[anchor.courseId];
      if (!slotsByDay) continue;
      events.push(...resolveCoursePlacements({
        classId, courseId: anchor.courseId, slotsByDay, startDate: anchor.startDate, from, to,
      }));
    }
    return events.sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
  },

  // Same class-resolution as listForTeacher, but returning calendar events instead of slots.
  resolveTeacherCalendar(teacherId, from, to) {
    const links = ClassCourseTeacherLinkModel.findByTeacherId(teacherId);
    const pairKey = (classId, courseId) => `${classId}:${courseId}`;
    const linkedPairs = new Set(links.map((l) => pairKey(l.classId, l.courseId)));
    const classIds = [...new Set(links.map((l) => l.classId))];
    return classIds
      .flatMap((classId) => TimetableService.resolveCalendar({ classId, from, to }))
      .filter((e) => linkedPairs.has(pairKey(e.classId, e.courseId)))
      .filter((e) => !e.teacherId || e.teacherId === teacherId);
  },

  // Same class-resolution as listForLearner, but returning calendar events instead of slots.
  resolveLearnerCalendar(learnerId, from, to) {
    const classIds = LearnerHubLinkModel.findByLearnerId(learnerId)
      .filter((l) => l.classId && l.status === "active")
      .map((l) => l.classId);
    return classIds.flatMap((classId) => TimetableService.resolveCalendar({ classId, from, to }));
  },

  // Every slot belonging to a (classId, courseId) pair this teacher is actually linked to (see
  // class-course-teacher-link.model.js) — a slot with no teacherId override is implied to be
  // taught by whichever educator(s) are linked to that course in that class, not just the
  // primary, so every co-teacher sees it on their own timetable too.
  listForTeacher(teacherId) {
    const links = ClassCourseTeacherLinkModel.findByTeacherId(teacherId);
    const pairKey = (classId, courseId) => `${classId}:${courseId}`;
    const linkedPairs = new Set(links.map((l) => pairKey(l.classId, l.courseId)));
    return TimetableModel.findAll()
      .filter((s) => linkedPairs.has(pairKey(s.classId, s.courseId)))
      .filter((s) => !s.teacherId || s.teacherId === teacherId);
  },

  // Every slot for every class this learner is currently actively enrolled in — a learner can
  // be enrolled at more than one hub/class at once (see learner-hub-link.model.js).
  listForLearner(learnerId) {
    const classIds = LearnerHubLinkModel.findByLearnerId(learnerId)
      .filter((l) => l.classId && l.status === "active")
      .map((l) => l.classId);
    return TimetableModel.findAll().filter((s) => classIds.includes(s.classId));
  },

  createSlot(data) {
    if (hasConflict(data)) {
      conflictError("This time overlaps with an existing slot for this class or teacher");
    }
    return TimetableModel.create(data);
  },

  updateSlot(id, data) {
    const existing = TimetableModel.findById(id);
    if (!existing) notFound("Timetable slot not found");
    const merged = { ...existing, ...data };
    if (hasConflict({ ...merged, excludeId: id })) {
      conflictError("This time overlaps with an existing slot for this class or teacher");
    }
    return TimetableModel.update(id, data);
  },

  deleteSlot(id) {
    const deleted = TimetableModel.delete(id);
    if (!deleted) notFound("Timetable slot not found");
    return { message: "Timetable slot deleted" };
  },
};

module.exports = TimetableService;
