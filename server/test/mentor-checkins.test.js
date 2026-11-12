const test = require("node:test");
const assert = require("node:assert/strict");

// Parent–mentor check-ins: the times a round offers, the educators' busy times, the draw, and where
// a check-in stands — pure, no database (modules/mentor-checkins/mentor-checkin.rules.js).
const R = require("../src/modules/mentor-checkins/mentor-checkin.rules");

// Mon 16 Nov 2026 – Fri 20 Nov 2026.
const WINDOW = { windowStart: "2026-11-16", windowEnd: "2026-11-20", days: ["monday", "wednesday"], dayStart: "15:00", dayEnd: "16:00", minutes: 20, gapMinutes: 0 };

test("a round offers each chosen weekday's times, a meeting length apart", () => {
  const slots = R.buildSlots(WINDOW);
  assert.deepEqual(slots.map((s) => s.key), [
    "2026-11-16 15:00", "2026-11-16 15:20", "2026-11-16 15:40",
    "2026-11-18 15:00", "2026-11-18 15:20", "2026-11-18 15:40",
  ]);
  assert.equal(slots[0].endTime, "15:20");
});

test("a gap between meetings, and a meeting must end by the day's end", () => {
  const slots = R.buildSlots({ ...WINDOW, days: ["monday"], minutes: 25, gapMinutes: 5 });
  assert.deepEqual(slots.map((s) => `${s.startTime}-${s.endTime}`), ["15:00-15:25", "15:30-15:55"]);
});

test("never a time sooner than the earliest allowed day", () => {
  const slots = R.buildSlots(WINDOW, { earliest: "2026-11-17" });
  assert.ok(slots.every((s) => s.date >= "2026-11-17"));
  assert.equal(slots.length, 3);
});

test("families get three days' notice", () => {
  assert.equal(R.firstAllowedDate("2026-11-10"), "2026-11-13");
});

test("the educators are busy in their classes and other check-ins", () => {
  const busy = {
    weekly: [{ dayOfWeek: "monday", startTime: "15:10", endTime: "15:30" }],
    dated: [{ date: "2026-11-18", startTime: "15:40", endTime: "16:00" }],
  };
  const free = R.buildSlots(WINDOW).filter((s) => !R.isBusy(s, busy)).map((s) => s.key);
  assert.deepEqual(free, ["2026-11-16 15:40", "2026-11-18 15:00", "2026-11-18 15:20"]);
  // Touching ends aren't a clash.
  assert.equal(R.timesOverlap({ startTime: "15:00", endTime: "15:20" }, { startTime: "15:20", endTime: "15:40" }), false);
});

test("the draw gives every family its own free time, in time order", () => {
  const families = ["a", "b", "c", "d"].map((parentUserId) => ({ parentUserId }));
  const draw = R.assignTimes(families, R.buildSlots(WINDOW), {}, { spread: "earliest", randomInt: () => 0 });
  assert.equal(draw.short, 0);
  assert.equal(new Set(draw.meetings.map((m) => m.parentUserId)).size, 4);
  assert.equal(new Set(draw.meetings.map((m) => `${m.date} ${m.startTime}`)).size, 4);
  const keys = draw.meetings.map((m) => `${m.date} ${m.startTime}`);
  assert.deepEqual(keys, [...keys].sort());
  assert.deepEqual(keys, ["2026-11-16 15:00", "2026-11-16 15:20", "2026-11-16 15:40", "2026-11-18 15:00"]);
});

test("spread spaces the families across the window", () => {
  const families = ["a", "b"].map((parentUserId) => ({ parentUserId }));
  const draw = R.assignTimes(families, R.buildSlots(WINDOW), {}, { spread: "spread", randomInt: () => 0 });
  assert.deepEqual(draw.meetings.map((m) => m.date), ["2026-11-16", "2026-11-18"]);
});

test("too few times: the draw says how many families are short", () => {
  const families = Array.from({ length: 8 }, (_, i) => ({ parentUserId: String(i) }));
  const draw = R.assignTimes(families, R.buildSlots(WINDOW), {}, { randomInt: () => 0 });
  assert.equal(draw.meetings.length, 6);
  assert.equal(draw.short, 2);
});

test("the shuffle keeps every family exactly once", () => {
  const list = Array.from({ length: 30 }, (_, i) => i);
  const out = R.shuffle(list);
  assert.deepEqual([...out].sort((a, b) => a - b), list);
});

test("where a check-in stands", () => {
  const today = "2026-11-18";
  assert.equal(R.meetingState({ status: "scheduled", date: "2026-11-20" }, today), "upcoming");
  assert.equal(R.meetingState({ status: "scheduled", date: today }, today), "today");
  assert.equal(R.meetingState({ status: "scheduled", date: "2026-11-16" }, today), "report_due");
  assert.equal(R.meetingState({ status: "held", date: "2026-11-16", reportSubmittedAt: new Date() }, today), "awaiting_approval");
  assert.equal(R.meetingState({ status: "held", date: "2026-11-16", reportSubmittedAt: new Date(), approvedAt: new Date() }, today), "approved");
  assert.equal(R.meetingState({ status: "missed", date: "2026-11-16" }, today), "missed");
  assert.equal(R.meetingState({ status: "cancelled", date: "2026-11-20" }, today), "cancelled");
});

test("the report needs both written parts", () => {
  assert.equal(R.reportProblems({ summary: "<p>Doing well</p>", actions: "<p></p>" }).length, 1);
  assert.deepEqual(R.reportProblems({ summary: "<p>Doing well</p>", actions: "None" }), []);
});

test("the report can be written before the planned day (13 Nov 2026), never once approved", () => {
  const today = "2026-11-18";
  const at = (m) => R.canReportIn(R.meetingState(m, today));
  assert.equal(at({ status: "scheduled", date: "2026-11-25" }), true, "upcoming: the family came in early");
  assert.equal(at({ status: "scheduled", date: today }), true);
  assert.equal(at({ status: "scheduled", date: "2026-11-10" }), true);
  assert.equal(at({ status: "held", date: "2026-11-25", reportSubmittedAt: new Date() }), true, "still correctable before approval");
  assert.equal(at({ status: "held", date: "2026-11-25", reportSubmittedAt: new Date(), approvedAt: new Date() }), false);
  assert.equal(at({ status: "missed", date: "2026-11-10" }), false);
  assert.equal(at({ status: "cancelled", date: "2026-11-25" }), false);
  // Written early, it waits for the parent's approval at once — whatever the planned date.
  assert.equal(R.meetingState({ status: "held", date: "2026-11-25", reportSubmittedAt: new Date() }, today), "awaiting_approval");
});
