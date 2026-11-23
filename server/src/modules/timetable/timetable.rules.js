// The timetable's rules, with nothing read or written (test/timetable-planner.test.js).
// Dates are "YYYY-MM-DD" Kenyan calendar dates, times "HH:MM".

const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const WEEKDAY_BY_INDEX = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
// An educator with less than this between lessons at two different physical hubs gets a warning.
const TRAVEL_MINUTES = 30;

const dayKey = (v) => (v instanceof Date ? v.toISOString().slice(0, 10) : v ? String(v).slice(0, 10) : null);
const toMinutes = (t) => { const [h, m] = String(t || "0:0").split(":").map(Number); return h * 60 + (m || 0); };
const weekdayOf = (date) => WEEKDAY_BY_INDEX[new Date(`${dayKey(date)}T12:00:00Z`).getUTCDay()];
const addDaysTo = (date, n) => {
  const d = new Date(`${dayKey(date)}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

// Whether this version of a lesson applies on a date (validFrom / validTo are optional).
function validOn(slot, date) {
  const from = dayKey(slot.validFrom);
  const to = dayKey(slot.validTo);
  return (!from || from <= date) && (!to || to >= date);
}

// The lesson that applies on a date, from one course's lessons on that weekday: the earliest.
function slotForDate(slots = [], date) {
  return slots.filter((s) => validOn(s, date)).sort((a, b) => a.startTime.localeCompare(b.startTime))[0] || null;
}

// Where a class stands, for the planner:
//   not_set         no lessons yet
//   needs_educator  a lesson on a course nobody teaches
//   needs_dates     a lesson on a course with no start date (it isn't on anyone's calendar)
//   ready           every lesson has an educator and a date
function classStatus({ lessons = [], educatorsByCourse = new Map(), datedCourseIds = new Set() }) {
  if (!lessons.length) return "not_set";
  if (lessons.some((l) => !l.teacherId && !(educatorsByCourse.get(l.courseId) || []).length)) return "needs_educator";
  if (lessons.some((l) => !datedCourseIds.has(l.courseId))) return "needs_dates";
  return "ready";
}

// Minutes between two lessons on one day; 0 when they overlap or touch.
function gapBetween(a, b) {
  const first = toMinutes(a.startTime) <= toMinutes(b.startTime) ? a : b;
  const second = first === a ? b : a;
  return Math.max(0, toMinutes(second.startTime) - toMinutes(first.endTime));
}

// The educator's lessons on that day at ANOTHER physical hub too close to this one to get there.
// Online hubs need no travel. Lessons that overlap are a clash, reported elsewhere.
function travelProblems(lesson, others = []) {
  if (lesson.virtual) return [];
  return others.filter((o) => {
    if (o.virtual || o.hubId === lesson.hubId) return false;
    const overlap = toMinutes(lesson.startTime) < toMinutes(o.endTime) && toMinutes(o.startTime) < toMinutes(lesson.endTime);
    return !overlap && gapBetween(lesson, o) < TRAVEL_MINUTES;
  });
}

// Where a course's sessions land from a start date on these weekdays, skipping days out of session:
// { first, last, placed } (`placed` < sessionCount when the run ends before they all fit).
function walkSessions({ startDate, days = [], sessionCount = 0, isSchedulable = () => true, limit = 1200 }) {
  if (!startDate || !days.length || !sessionCount) return { first: null, last: null, placed: 0 };
  const wanted = new Set(days);
  let date = dayKey(startDate);
  let first = null;
  let last = null;
  let placed = 0;
  for (let i = 0; i < limit && placed < sessionCount; i += 1, date = addDaysTo(date, 1)) {
    if (!wanted.has(weekdayOf(date)) || !isSchedulable(date)) continue;
    first = first || date;
    last = date;
    placed += 1;
  }
  return { first, last, placed };
}

// One class's copy result from its lessons' outcomes. Only a fully "ready" class is copied.
const COPY_ORDER = ["clash", "missing_educator", "missing_course"];
function copyStatus(lessons = []) {
  for (const status of COPY_ORDER) if (lessons.some((l) => l.status === status)) return status;
  return lessons.some((l) => l.status === "ready") ? "ready" : "already_set";
}

module.exports = {
  DAYS, TRAVEL_MINUTES, dayKey, toMinutes, weekdayOf, addDaysTo,
  validOn, slotForDate, classStatus, gapBetween, travelProblems, walkSessions, copyStatus,
};
