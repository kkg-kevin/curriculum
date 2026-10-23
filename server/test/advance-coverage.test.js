const test = require("node:test");
const assert = require("node:assert/strict");

// env.js refuses to load without these; the values are only used inside this test.
process.env.JWT_SECRET ||= "test-secret";
process.env.CLIENT_URL ||= "http://localhost:5173";
process.env.DB_USER ||= "test";
process.env.DB_PASSWORD ||= "test";
process.env.DB_NAME ||= "test";

// Minimum course coverage before an advance (Settings → Educator pay) — see claim.service.js.
const { buildFigures, requiredCoverage } = require("../src/modules/claims/claim.service")._internal;

const course = { id: "c1" };
const sessions = Array.from({ length: 10 }, (_, i) => ({ id: `s${i + 1}`, courseId: "c1" }));
const ran = (count) => sessions.slice(0, count).map((s, i) => ({ courseId: "c1", sessionId: s.id, date: `2026-01-${String(i + 1).padStart(2, "0")}`, status: "taught" }));
const base = { sessionRate: 500, hourlyRate: null, dailyRate: null, commissionRate: null, advancePercent: 30, currency: "KES" };
const figures = (delivered, coverage = {}) => buildFigures({
  course, sessions, occurrences: ran(delivered), slots: [], claims: [], settings: { ...base, ...coverage }, rateType: "session",
});

test("no minimum: an advance is open from the start, as before", () => {
  const f = figures(0);
  assert.equal(f.advanceMinSessions, 0);
  assert.equal(f.canRequestAdvance, true);
});

test("a percentage of the course's sessions, rounded up", () => {
  assert.equal(requiredCoverage({ advanceCoveragePercent: 25 }, 10), 3);
  const before = figures(2, { advanceCoveragePercent: 25 });
  assert.equal(before.canRequestAdvance, false);
  assert.match(before.advanceBlocked, /once 3 of this course's 10 sessions are delivered — 1 more to go/);
  assert.equal(figures(3, { advanceCoveragePercent: 25 }).canRequestAdvance, true);
});

test("a number of delivered sessions", () => {
  const before = figures(3, { advanceCoverageSessions: 4 });
  assert.equal(before.advanceMinSessions, 4);
  assert.match(before.advanceBlocked, /once 4 of this course's 10 sessions are delivered — 1 more to go/);
  assert.equal(figures(4, { advanceCoverageSessions: 4 }).canRequestAdvance, true);
});

test("a course too short for the minimum points to the full payment", () => {
  const f = figures(5, { advanceCoverageSessions: 12 });
  assert.equal(f.canRequestAdvance, false);
  assert.match(f.advanceBlocked, /needs 12 delivered sessions and this course has 10/);
});

test("both set: whichever comes first opens the advance", () => {
  const both = { advanceCoveragePercent: 50, advanceCoverageSessions: 3 };
  assert.equal(requiredCoverage(both, 10), 3, "3 sessions comes before 50% (5)");
  assert.equal(requiredCoverage(both, 4), 2, "on a 4-session course 50% (2) comes first");
  assert.equal(figures(2, both).canRequestAdvance, false);
  assert.equal(figures(3, both).canRequestAdvance, true);
});

test("the full payment isn't affected by the minimum", () => {
  const f = figures(10, { advanceCoveragePercent: 50 });
  assert.equal(f.canRequestFull, true);
});
