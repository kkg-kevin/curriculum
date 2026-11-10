// The rules for parent–mentor check-ins — pure, no database, tested on their own
// (test/mentor-checkins.test.js). Dates are "YYYY-MM-DD" Kenyan calendar dates, times "HH:MM".

const { addDays } = require("../checkins/checkin.dates");
const { hasContent } = require("../checkins/checkin.rules");

// Families hear about their check-in at least this many days before it: the first time a round
// can give anyone is this many days after the day it's set up.
const MIN_NOTICE_DAYS = 3;
// A parent changing their time picks from the round's free times from tomorrow on.
const PARENT_CHANGE_MIN_DAYS = 1;
// The pop-up shows a coming check-in from this many days before it.
const POPUP_DAYS = 3;
// How many times one round may offer (a guard against a window of years of 5-minute slots).
const MAX_SLOTS = 3000;

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

const pad = (n) => String(n).padStart(2, "0");
const toMinutes = (time) => {
  const [h, m] = String(time || "").split(":").map(Number);
  return h * 60 + m;
};
const fromMinutes = (n) => `${pad(Math.floor(n / 60))}:${pad(n % 60)}`;
const weekdayOf = (date) => WEEKDAYS[new Date(`${date}T00:00:00Z`).getUTCDay()];
const slotKey = (date, startTime) => `${date} ${startTime}`;

// The first day a new round may give a family: MIN_NOTICE_DAYS from today.
const firstAllowedDate = (today) => addDays(today, MIN_NOTICE_DAYS);

// Every time the round's window offers, in order: each chosen weekday from the window's first
// day (never before `earliest`) to its last, from the day's start, one meeting length plus the gap
// apart, while a meeting still ends by the day's end.
function buildSlots({ windowStart, windowEnd, days, dayStart, dayEnd, minutes, gapMinutes = 0 }, { earliest = null } = {}) {
  const slots = [];
  const wanted = new Set(days || []);
  const start = toMinutes(dayStart);
  const end = toMinutes(dayEnd);
  const step = Number(minutes) + Number(gapMinutes || 0);
  if (!(minutes > 0) || !(step > 0) || end <= start) return slots;
  let date = earliest && earliest > windowStart ? earliest : windowStart;
  for (let guard = 0; date <= windowEnd && guard < 800; guard += 1, date = addDays(date, 1)) {
    if (!wanted.has(weekdayOf(date))) continue;
    for (let t = start; t + Number(minutes) <= end; t += step) {
      slots.push({ date, startTime: fromMinutes(t), endTime: fromMinutes(t + Number(minutes)), key: slotKey(date, fromMinutes(t)) });
      if (slots.length >= MAX_SLOTS) return slots;
    }
  }
  return slots;
}

// Whether two time ranges on the same day overlap (touching ends don't).
const timesOverlap = (a, b) => toMinutes(a.startTime) < toMinutes(b.endTime) && toMinutes(b.startTime) < toMinutes(a.endTime);

// Whether the educators are already busy at this time: a class on their weekly timetable
// (`weekly`: { dayOfWeek, startTime, endTime }), or another check-in of theirs (`dated`: { date,
// startTime, endTime }).
function isBusy(slot, busy = {}) {
  const day = weekdayOf(slot.date);
  if ((busy.weekly || []).some((b) => b.dayOfWeek === day && timesOverlap(slot, b))) return true;
  return (busy.dated || []).some((b) => b.date === slot.date && timesOverlap(slot, b));
}

// A fair shuffle (Fisher–Yates). `randomInt(n)` gives 0…n-1 — the service passes crypto's.
function shuffle(list, randomInt = (n) => Math.floor(Math.random() * n)) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// Which of `count` free times to use: "earliest" fills them in order; "spread" spaces the families
// evenly across every free time in the window (so they don't all land on the first afternoon).
function chooseSlots(free, count, spread = "spread") {
  if (count <= 0) return [];
  if (spread === "earliest" || count >= free.length) return free.slice(0, count);
  const picked = [];
  for (let i = 0; i < count; i += 1) picked.push(free[Math.floor((i * free.length) / count)]);
  return picked;
}

// The draw: every family (in a random order) gets one free time — never one the educators are
// busy at, never one another family has. `short` is how many families didn't get one (the window
// is too small).
function assignTimes(families, slots, busy, { spread = "spread", randomInt } = {}) {
  const free = slots.filter((s) => !isBusy(s, busy));
  const order = shuffle(families, randomInt);
  const chosen = chooseSlots(free, Math.min(order.length, free.length), spread);
  const meetings = chosen.map((slot, i) => ({ ...order[i], date: slot.date, startTime: slot.startTime, endTime: slot.endTime }));
  // Shown in time order.
  meetings.sort((a, b) => (a.date === b.date ? a.startTime.localeCompare(b.startTime) : a.date.localeCompare(b.date)));
  return { meetings, short: order.length - meetings.length, freeCount: free.length };
}

// Where a check-in stands today.
//   cancelled / missed      as marked
//   approved                the report is in and the parent has approved it
//   awaiting_approval       the report is in, waiting for the parent
//   upcoming / today        not happened yet
//   report_due              its day has passed and its report isn't in
function meetingState(meeting, today) {
  if (meeting.status === "cancelled") return "cancelled";
  if (meeting.status === "missed") return "missed";
  if (meeting.reportSubmittedAt) return meeting.approvedAt ? "approved" : "awaiting_approval";
  if (meeting.date > today) return "upcoming";
  if (meeting.date === today) return "today";
  return "report_due";
}

// The report's two written parts, both needed (write "None" when there's nothing to say).
const REPORT_PARTS = [
  ["summary", "How the child is doing"],
  ["actions", "What was agreed"],
];
function reportProblems(report) {
  return REPORT_PARTS.filter(([key]) => !hasContent(report?.[key])).map(([, label]) => `Write "${label}"`);
}

module.exports = {
  MIN_NOTICE_DAYS, PARENT_CHANGE_MIN_DAYS, POPUP_DAYS, MAX_SLOTS, WEEKDAYS, REPORT_PARTS,
  toMinutes, fromMinutes, weekdayOf, slotKey, firstAllowedDate,
  buildSlots, timesOverlap, isBusy, shuffle, chooseSlots, assignTimes, meetingState, reportProblems,
};
