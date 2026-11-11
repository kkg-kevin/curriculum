const { test } = require("node:test");
const assert = require("node:assert/strict");
const R = require("../src/modules/mentor-bookings/mentor-booking.rules");

// Mentor bookings — the rules (src/modules/mentor-bookings/mentor-booking.rules.js).

test("settings: off by default, and switching on needs every length priced", () => {
  assert.equal(R.cleanSettings({}).settings.enabled, false);
  assert.match(R.cleanSettings({ enabled: true, lengths: [{ minutes: 60, price: null, educatorPay: 500 }] }).error, /60 minutes/);
  assert.match(R.cleanSettings({ enabled: true, lengths: [{ minutes: 60, price: 1000, educatorPay: 1200 }] }).error, /can't earn more/);
  assert.match(R.cleanSettings({ enabled: true, lengths: [] }).error, /at least one/);
  const ok = R.cleanSettings({ enabled: true, lengths: [{ minutes: 60, price: 1500, educatorPay: 1000 }, { minutes: 30, price: 800, educatorPay: 500 }, { minutes: 25, price: 1 }] });
  assert.equal(ok.error, null);
  assert.deepEqual(ok.settings.lengths.map((l) => l.minutes), [30, 60]); // sorted, odd lengths dropped
  assert.deepEqual(R.priceFor(ok.settings, 60), { price: 1500, educatorPay: 1000 });
  assert.equal(R.priceFor(ok.settings, 45), null);
});

test("settings: numbers are kept in range", () => {
  const { settings } = R.cleanSettings({ noticeHours: 0, holdMinutes: 5, cancelHours: -3, horizonDays: 500 });
  assert.equal(settings.noticeHours, 1);
  assert.equal(settings.holdMinutes, 15);
  assert.equal(settings.cancelHours, 0);
  assert.equal(settings.horizonDays, 90);
});

test("desk fee follows the space's pricing", () => {
  assert.equal(R.deskFeeFor({ pricingModel: "hourly", rate: 300 }, 90), 450);
  assert.equal(R.deskFeeFor({ pricingModel: "daily", rate: 700 }, 30), 700);
  assert.equal(R.deskFeeFor({ pricingModel: "fixed", rate: 250 }, 120), 250);
  assert.equal(R.deskFeeFor({ pricingModel: "free", rate: 999 }, 60), 0);
  assert.equal(R.deskFeeFor(null, 60), 0);
});

test("a partner hub is owed its desk fee less the collection share; our own hub nothing", () => {
  assert.equal(R.hubShareFor(500, "hub", 10), 450);
  assert.equal(R.hubShareFor(500, "hub", 0), 500);
  assert.equal(R.hubShareFor(500, "hub", 150), 0);
  assert.equal(R.hubShareFor(500, "ours", 10), 0);
  assert.equal(R.hubShareFor(0, "hub", 10), 0);
});

test("free times: inside availability, on the half hour, after the notice, never when busy", () => {
  // Wed 11 Nov 2026, 08:00 in Kenya (05:00 UTC); 24 h notice.
  const now = new Date("2026-11-11T05:00:00Z");
  const windows = [{ dayOfWeek: "thursday", startTime: "07:15", endTime: "10:00" }, { dayOfWeek: "saturday", startTime: "09:00", endTime: "11:00" }];
  const busy = { weekly: [{ dayOfWeek: "saturday", startTime: "10:00", endTime: "11:00" }], dated: [{ date: "2026-11-12", startTime: "09:00", endTime: "09:30" }] };
  const slots = R.freeSlots({ windows, minutes: 60, busy, noticeHours: 24, horizonDays: 4, now });
  // Thursday: from 08:00 (24 h on, and the grid starts at 07:30) — 08:00 clashes with 09:00 busy? 08:00–09:00 doesn't overlap 09:00–09:30.
  assert.deepEqual(slots.map((s) => `${s.date} ${s.startTime}`), ["2026-11-12 08:00", "2026-11-14 09:00"]);
  assert.equal(slots[0].endTime, "09:00");
  assert.deepEqual(R.freeSlots({ windows: [], minutes: 60, now }), []);
});

test("free times: a length longer than the window offers nothing", () => {
  const now = new Date("2026-11-11T05:00:00Z");
  assert.deepEqual(R.freeSlots({ windows: [{ dayOfWeek: "friday", startTime: "09:00", endTime: "09:45" }], minutes: 60, now, noticeHours: 1, horizonDays: 3 }), []);
});

test("a held time stops holding once its hold runs out", () => {
  const now = new Date("2026-11-11T10:00:00Z");
  assert.equal(R.holdsTime({ status: "held", holdExpiresAt: "2026-11-11T11:00:00Z" }, now), true);
  assert.equal(R.holdsTime({ status: "held", holdExpiresAt: "2026-11-11T09:00:00Z" }, now), false);
  assert.equal(R.holdsTime({ status: "confirmed" }, now), true);
  assert.equal(R.holdsTime({ status: "cancelled" }, now), false);
});

test("states: held, confirmed, today, to mark", () => {
  const now = new Date("2026-11-11T07:00:00Z"); // 10:00 in Kenya
  assert.equal(R.bookingState({ status: "confirmed", date: "2026-11-12", startTime: "09:00" }, now), "confirmed");
  assert.equal(R.bookingState({ status: "confirmed", date: "2026-11-11", startTime: "15:00" }, now), "today");
  assert.equal(R.bookingState({ status: "confirmed", date: "2026-11-11", startTime: "09:30" }, now), "to_mark");
  assert.equal(R.bookingState({ status: "held", holdExpiresAt: "2026-11-11T06:00:00Z", date: "2026-11-12", startTime: "09:00" }, now), "cancelled");
  assert.equal(R.canMark({ status: "confirmed", date: "2026-11-11", startTime: "09:30" }, now), true);
  assert.equal(R.canMark({ status: "confirmed", date: "2026-11-11", startTime: "10:30" }, now), false);
});

test("cancelling: parents up to the cut-off with their money back; the mentor or staff any time", () => {
  const now = new Date("2026-11-11T07:00:00Z"); // 10:00 in Kenya
  const tomorrow = { status: "confirmed", date: "2026-11-12", startTime: "09:00" }; // 23 h away
  assert.equal(R.cancelOutcome(tomorrow, { by: "parent", paid: 1500, cancelHours: 24, now }).allowed, false);
  assert.deepEqual(R.cancelOutcome(tomorrow, { by: "parent", paid: 1500, cancelHours: 12, now }), { allowed: true, refund: 1500, keepHubShare: false });
  assert.equal(R.cancelOutcome(tomorrow, { by: "mentor", paid: 1500, cancelHours: 24, now }).refund, 1500);
  assert.equal(R.cancelOutcome({ status: "held", date: "2026-11-12", startTime: "09:00" }, { by: "parent", paid: 0, now }).allowed, true);
  assert.equal(R.cancelOutcome({ status: "completed" }, { by: "staff" }).allowed, false);
});

test("plan allowance", () => {
  assert.equal(R.allowanceLeft(2, 0), 2);
  assert.equal(R.allowanceLeft(2, 3), 0);
  assert.equal(R.allowanceLeft(0, 0), 0);
});
