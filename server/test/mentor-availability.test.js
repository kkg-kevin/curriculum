const { test } = require("node:test");
const assert = require("node:assert/strict");
const A = require("../src/modules/mentor-bookings/availability.rules");
const R = require("../src/modules/mentor-bookings/mentor-booking.rules");

// A mentor's availability: hours offered to families, minus whatever is really on that date.
// 2026-11-23 is a Monday.

const w = (dayOfWeek, startTime, endTime) => ({ dayOfWeek, startTime, endTime });
const cls = (date, startTime, endTime) => ({ kind: "class", date, startTime, endTime });

test("saving hours joins overlapping and touching times, per day, in order", () => {
  const { windows, error } = A.normaliseWindows([w("tuesday", "14:00", "16:00"), w("monday", "10:00", "11:00"), w("monday", "09:00", "10:00"), w("monday", "10:30", "12:00")]);
  assert.equal(error, null);
  assert.deepEqual(windows, [w("monday", "09:00", "12:00"), w("tuesday", "14:00", "16:00")]);
});

test("saving hours refuses a backwards, too-short or unknown time", () => {
  assert.match(A.normaliseWindows([w("monday", "12:00", "11:00")]).error, /after start/);
  assert.match(A.normaliseWindows([w("monday", "12:00", "12:15")]).error, /at least 30/);
  assert.match(A.normaliseWindows([w("someday", "12:00", "13:00")]).error, /valid day/);
  assert.deepEqual(A.normaliseWindows([]), { windows: [], error: null });
});

test("a class overrides the hours under it, and the rest stay open", () => {
  const day = A.planDay({ date: "2026-11-23", windows: [w("monday", "14:00", "18:00")], busy: [cls("2026-11-23", "15:00", "16:00")] });
  assert.deepEqual(day.open, [{ startTime: "14:00", endTime: "15:00" }, { startTime: "16:00", endTime: "18:00" }]);
  assert.deepEqual(day.byClass, [{ startTime: "15:00", endTime: "16:00" }]);
  assert.deepEqual(day.offered, [{ startTime: "14:00", endTime: "18:00" }], "the saved hours are never rewritten");
});

test("the same hours are open again on a date with no class (a term break, a finished course)", () => {
  const windows = [w("monday", "14:00", "18:00")];
  const day = A.planDay({ date: "2026-11-30", windows, busy: [cls("2026-11-23", "15:00", "16:00")] });
  assert.deepEqual(day.open, [{ startTime: "14:00", endTime: "18:00" }]);
  assert.deepEqual(day.byClass, []);
});

test("nothing inside the booking notice is open", () => {
  const windows = [w("monday", "09:00", "17:00")];
  assert.deepEqual(A.planDay({ date: "2026-11-23", windows, earliest: { date: "2026-11-24", minutes: 0 } }).open, []);
  assert.deepEqual(A.planDay({ date: "2026-11-23", windows, earliest: { date: "2026-11-23", minutes: 13 * 60 } }).open, [{ startTime: "13:00", endTime: "17:00" }]);
});

test("a gap too short to book isn't counted as open", () => {
  const day = A.planDay({ date: "2026-11-23", windows: [w("monday", "14:00", "16:00")], busy: [cls("2026-11-23", "14:15", "16:00")] });
  assert.deepEqual(day.open, []);
});

test("the week runs Monday to Sunday from any of its days", () => {
  assert.equal(A.mondayOf("2026-11-29"), "2026-11-23");
  assert.equal(A.mondayOf("2026-11-23"), "2026-11-23");
  assert.deepEqual([A.weekDates("2026-11-25")[0], A.weekDates("2026-11-25")[6]], ["2026-11-23", "2026-11-29"]);
});

test("a replacement is the same length, free, and on the same day when it can be", () => {
  const dates = A.weekDates("2026-11-23");
  const windows = [w("monday", "14:00", "16:00")];
  const busy = [cls("2026-11-23", "14:00", "16:00")];
  const days = dates.map((date) => ({ ...A.planDay({ date, windows, busy }), busy: busy.filter((b) => b.date === date) }));
  const [first] = A.suggestReplacements(days);
  assert.equal(first.dayOfWeek, "monday");
  assert.equal(first.startTime, "16:00");
  assert.equal(first.endTime, "18:00");
  assert.deepEqual(first.replaces, { dayOfWeek: "monday", startTime: "14:00", endTime: "16:00" });
});

test("a full day's replacement moves to the nearest day", () => {
  const dates = A.weekDates("2026-11-23");
  const windows = [w("monday", "08:00", "19:00")];
  const busy = [cls("2026-11-23", "08:00", "19:00")];
  const days = dates.map((date) => ({ ...A.planDay({ date, windows, busy }), busy: busy.filter((b) => b.date === date) }));
  assert.equal(A.suggestReplacements(days)[0].dayOfWeek, "tuesday");
});

test("a booking clashes only with a class on its own date and time", () => {
  const b = { date: "2026-11-23", startTime: "15:00", endTime: "16:00" };
  assert.ok(A.clashingClass(b, [cls("2026-11-23", "15:30", "16:30")]));
  assert.equal(A.clashingClass(b, [cls("2026-11-23", "16:00", "17:00")]), null, "touching ends don't clash");
  assert.equal(A.clashingClass(b, [cls("2026-11-30", "15:00", "16:00")]), null);
});

test("outside stated hours is judged against the joined hours, and no hours means no warning", () => {
  const windows = [w("monday", "09:00", "12:00"), w("monday", "12:00", "15:00")];
  assert.equal(A.insideStatedHours(windows, { dayOfWeek: "monday", startTime: "11:00", endTime: "13:00" }), true);
  assert.equal(A.insideStatedHours(windows, { dayOfWeek: "tuesday", startTime: "11:00", endTime: "13:00" }), false);
  assert.equal(A.insideStatedHours([], { dayOfWeek: "monday", startTime: "11:00", endTime: "13:00" }), true);
});

test("a session a class took over reads as needing a new time, and can't be marked as held", () => {
  const b = { status: "confirmed", date: "2026-11-23", startTime: "10:00", clashAt: new Date("2026-11-20T08:00:00Z") };
  const after = new Date("2026-11-23T12:00:00+03:00");
  assert.equal(R.bookingState(b, after), "needs_new_time");
  assert.equal(R.canMark(b, after), false);
  assert.equal(R.canMark({ ...b, clashAt: null }, after), true);
});

test("the family may cancel a clashed session inside the cut-off, with everything back", () => {
  const b = { status: "confirmed", date: "2026-11-23", startTime: "10:00" };
  const now = new Date("2026-11-23T08:00:00+03:00");
  assert.equal(R.cancelOutcome(b, { by: "parent", paid: 1500, cancelHours: 24, now }).allowed, false);
  assert.deepEqual(R.cancelOutcome({ ...b, clashAt: now }, { by: "parent", paid: 1500, cancelHours: 24, now }), { allowed: true, refund: 1500, keepHubShare: false });
});
