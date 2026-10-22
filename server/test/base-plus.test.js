const test = require("node:test");
const assert = require("node:assert/strict");

// env.js refuses to load without these; the values are only used inside this test.
process.env.JWT_SECRET ||= "test-secret";
process.env.CLIENT_URL ||= "http://localhost:5173";
process.env.DB_USER ||= "test";
process.env.DB_PASSWORD ||= "test";
process.env.DB_NAME ||= "test";

// Base plus: each session pays the session rate (the base) plus a commission for every learner
// enrolled in the class — see claim.service.js.
const { buildFigures, rateTypesOf } = require("../src/modules/claims/claim.service")._internal;

const course = { id: "c1" };
const sessions = Array.from({ length: 10 }, (_, i) => ({ id: `s${i + 1}`, courseId: "c1" }));
// The first 4 sessions ran in January 2026; the other 6 are still to come.
const occurrences = sessions.slice(0, 4).map((s, i) => ({ courseId: "c1", sessionId: s.id, date: `2026-01-0${i + 1}`, status: "taught" }));
const settings = { sessionRate: 500, hourlyRate: null, dailyRate: null, commissionRate: 50, advancePercent: 30, currency: "KES" };
const figures = (overrides = {}) => buildFigures({
  course, sessions, occurrences, slots: [], claims: [], settings, rateType: "base_plus", learnerCount: 12, ...overrides,
});

test("a session pays the base plus the commission for each enrolled learner", () => {
  const f = figures();
  assert.equal(f.rate, 1100, "500 + 12 × 50");
  assert.equal(f.baseRate, 500);
  assert.equal(f.commissionRate, 50);
  assert.equal(f.learnerCount, 12);
  assert.equal(f.sessionRate, 500, "the base, for screens reading the session-only name");
  assert.equal(f.unitsTotal, 10);
  assert.equal(f.unitsDelivered, 4);
  assert.equal(f.courseAmount, 11000);
  assert.equal(f.earnedAmount, 4400);
  assert.equal(f.advanceAmount, 3300, "30% of the course");
  assert.equal(f.canRequestAdvance, true);
});

test("no learners is just the base; decimals stay until the course total", () => {
  assert.equal(figures({ learnerCount: 0 }).rate, 500);
  const f = figures({ settings: { ...settings, sessionRate: 904.666, commissionRate: 25.5 }, learnerCount: 3 });
  assert.equal(f.rate, 981.166);
  assert.equal(f.courseAmount, 9812, "rounded to the shilling only at the total");
});

test("Base plus needs both the session rate and the commission", () => {
  const noCommission = figures({ settings: { ...settings, commissionRate: null } });
  assert.equal(noCommission.rate, null);
  assert.equal(noCommission.canRequestAdvance, false);
  assert.match(noCommission.advanceBlocked, /commission per learner isn't set/);
  const noBase = figures({ settings: { ...settings, sessionRate: null } });
  assert.match(noBase.advanceBlocked, /on top of the session rate/);
});

test("plain per-session pay is unchanged by the learner count", () => {
  const f = figures({ rateType: "session" });
  assert.equal(f.rate, 500);
  assert.equal(f.courseAmount, 5000);
  assert.equal(f.learnerCount, undefined);
});

test("an educator can be tagged Base plus", () => {
  assert.deepEqual(rateTypesOf({ payRateTypes: ["base_plus", "session"] }), ["session", "base_plus"]);
  assert.deepEqual(rateTypesOf({ payRateTypes: JSON.stringify(["base_plus"]) }), ["base_plus"]);
});
