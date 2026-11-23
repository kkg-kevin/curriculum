const { addDays } = require("../checkins/checkin.dates");
const { toMinutes, fromMinutes, weekdayOf, timesOverlap } = require("../mentor-checkins/mentor-checkin.rules");

// A mentor's availability — the rules, with nothing read or written (test/mentor-availability.test.js).
//
// Availability is the weekly hours a mentor offers FAMILIES. It never limits the class timetable:
// what a family can book is availability minus whatever the mentor is busy with on that date. The
// saved hours are never rewritten, so when a class ends, the hours under it open again by themselves.

const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const MIN_WINDOW_MINUTES = 30;
const MAX_WINDOWS = 60;
const STEP = 30;

const hhmm = (t) => String(t || "").slice(0, 5);
const span = (r) => toMinutes(r.endTime) - toMinutes(r.startTime);
const range = (start, end) => ({ startTime: fromMinutes(start), endTime: fromMinutes(end) });

// Overlapping or touching ranges joined, in time order.
function mergeRanges(list = []) {
  const sorted = list
    .map((r) => [toMinutes(r.startTime), toMinutes(r.endTime)])
    .filter(([a, b]) => b > a)
    .sort((x, y) => x[0] - y[0] || x[1] - y[1]);
  const out = [];
  for (const [a, b] of sorted) {
    const last = out[out.length - 1];
    if (last && a <= last[1]) last[1] = Math.max(last[1], b);
    else out.push([a, b]);
  }
  return out.map(([a, b]) => range(a, b));
}

// The parts of `r` that `busy` doesn't cover.
function subtract(r, busy = []) {
  let cursor = toMinutes(r.startTime);
  const end = toMinutes(r.endTime);
  const out = [];
  for (const b of mergeRanges(busy)) {
    const bStart = toMinutes(b.startTime);
    const bEnd = toMinutes(b.endTime);
    if (bEnd <= cursor) continue;
    if (bStart >= end) break;
    if (bStart > cursor) out.push(range(cursor, bStart));
    cursor = Math.max(cursor, bEnd);
  }
  if (cursor < end) out.push(range(cursor, end));
  return out;
}

// The parts of `r` that `busy` does cover.
function intersect(r, busy = []) {
  const start = toMinutes(r.startTime);
  const end = toMinutes(r.endTime);
  return mergeRanges(busy)
    .map((b) => [Math.max(start, toMinutes(b.startTime)), Math.min(end, toMinutes(b.endTime))])
    .filter(([a, b]) => b > a)
    .map(([a, b]) => range(a, b));
}

// Typed windows → clean ones (per day, joined, in order), or the first thing wrong.
function normaliseWindows(list = []) {
  const byDay = new Map(DAYS.map((d) => [d, []]));
  for (const w of list) {
    if (!byDay.has(w?.dayOfWeek)) return { windows: [], error: "Select a valid day" };
    const startTime = hhmm(w.startTime);
    const endTime = hhmm(w.endTime);
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(endTime)) {
      return { windows: [], error: "Enter times as HH:MM" };
    }
    if (startTime >= endTime) return { windows: [], error: "End time must be after start time" };
    if (toMinutes(endTime) - toMinutes(startTime) < MIN_WINDOW_MINUTES) {
      return { windows: [], error: `Make each time at least ${MIN_WINDOW_MINUTES} minutes` };
    }
    byDay.get(w.dayOfWeek).push({ startTime, endTime });
  }
  const windows = DAYS.flatMap((dayOfWeek) => mergeRanges(byDay.get(dayOfWeek)).map((r) => ({ dayOfWeek, ...r })));
  if (windows.length > MAX_WINDOWS) return { windows: [], error: `Keep it to ${MAX_WINDOWS} times a week` };
  return { windows, error: null };
}

// The Monday of the week holding this date.
function mondayOf(date) {
  return addDays(date, -DAYS.indexOf(weekdayOf(date)));
}
const weekDates = (date) => {
  const monday = mondayOf(date);
  return DAYS.map((_, i) => addDays(monday, i));
};

// One date of the planner:
//   offered  the mentor's hours that weekday
//   open     what a family can book: offered, less anything busy, less what's inside the notice
//   byClass  the offered hours a class has taken over
function planDay({ date, windows = [], busy = [], earliest = null }) {
  const dayOfWeek = weekdayOf(date);
  const offered = mergeRanges(windows.filter((w) => w.dayOfWeek === dayOfWeek));
  const today = busy.filter((b) => String(b.date).slice(0, 10) === date);
  const classes = today.filter((b) => b.kind === "class");
  const byClass = mergeRanges(offered.flatMap((w) => intersect(w, classes)));
  let open = offered.flatMap((w) => subtract(w, today));
  if (earliest) {
    if (date < earliest.date) open = [];
    else if (date === earliest.date) {
      open = open.flatMap((r) => subtract(r, [{ startTime: "00:00", endTime: fromMinutes(Math.min(earliest.minutes, 1439)) }]));
    }
  }
  open = open.filter((r) => span(r) >= MIN_WINDOW_MINUTES);
  return { date, dayOfWeek, offered, open, byClass };
}

const totalMinutes = (ranges) => ranges.reduce((n, r) => n + span(r), 0);
function summarise(days = []) {
  return {
    offeredMinutes: days.reduce((n, d) => n + totalMinutes(d.offered), 0),
    openMinutes: days.reduce((n, d) => n + totalMinutes(d.open), 0),
    byClassMinutes: days.reduce((n, d) => n + totalMinutes(d.byClass), 0),
  };
}

// Hours a mentor could offer instead of the ones a class took: the same length, free of their
// hours and everything on that week, as near the lost time as possible — the same day first, then
// the nearest days. Only ever a suggestion: the mentor adds it with one tap, or doesn't.
function suggestReplacements(days = [], { limit = 3, dayStart = 8 * 60, dayEnd = 19 * 60 } = {}) {
  const out = [];
  const blockedOn = (day) => [
    ...day.offered,
    ...(day.busy || []),
    ...out.filter((s) => s.dayOfWeek === day.dayOfWeek),
  ];
  days.forEach((day, index) => {
    for (const lost of day.byClass) {
      if (out.length >= limit) return;
      const length = Math.min(span(lost), 180);
      const nearest = days
        .map((d, i) => ({ d, distance: Math.abs(i - index) }))
        .sort((a, b) => a.distance - b.distance)
        .map((x) => x.d);
      for (const candidate of nearest) {
        const target = toMinutes(lost.startTime);
        let best = null;
        for (const gap of subtract(range(dayStart, dayEnd), blockedOn(candidate))) {
          const low = Math.ceil(toMinutes(gap.startTime) / STEP) * STEP;
          const high = Math.floor((toMinutes(gap.endTime) - length) / STEP) * STEP;
          if (high < low) continue;
          const start = Math.min(high, Math.max(low, Math.round(target / STEP) * STEP));
          // Equally near: the later one — families mostly book after school.
          if (best == null || Math.abs(start - target) <= Math.abs(best - target)) best = start;
        }
        if (best == null) continue;
        out.push({
          dayOfWeek: candidate.dayOfWeek,
          ...range(best, best + length),
          replaces: { dayOfWeek: day.dayOfWeek, startTime: lost.startTime, endTime: lost.endTime },
          key: `${day.dayOfWeek}|${lost.startTime}|${lost.endTime}`,
        });
        break;
      }
    }
  });
  return out;
}

// The class this booking's time now overlaps, or null.
function clashingClass(booking, classTimes = []) {
  const date = String(booking.date).slice(0, 10);
  return classTimes.find((c) => String(c.date).slice(0, 10) === date && timesOverlap(booking, c)) || null;
}

// Whether a weekly class time sits fully inside the mentor's stated hours (no hours set = yes).
// Only ever a soft warning for whoever sets the timetable: it never stops a class being saved.
function insideStatedHours(windows = [], { dayOfWeek, startTime, endTime }) {
  if (!windows.length) return true;
  const day = mergeRanges(windows.filter((w) => w.dayOfWeek === dayOfWeek));
  return day.some((w) => hhmm(startTime) >= w.startTime && hhmm(endTime) <= w.endTime);
}

module.exports = {
  DAYS, MIN_WINDOW_MINUTES, MAX_WINDOWS,
  hhmm, mergeRanges, subtract, intersect, normaliseWindows, mondayOf, weekDates, planDay, summarise,
  suggestReplacements, clashingClass, insideStatedHours,
};
