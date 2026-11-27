// Learner follow-up cases (26 Nov 2026): the rules in analytics.cases.rules.js.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const R = require("../src/modules/analytics/analytics.cases.rules");

test("absences in a row: counted back from the latest, excused days skipped", () => {
  const rows = [
    { date: "2026-11-02", status: "present" },
    { date: "2026-11-09", status: "absent" },
    { date: "2026-11-12", status: "excused" },
    { date: "2026-11-16", status: "absent" },
    { date: "2026-11-23", status: "absent" },
  ];
  assert.deepEqual(R.absenceRun(rows), { count: 3, dates: ["2026-11-09", "2026-11-16", "2026-11-23"] });
  assert.equal(R.absenceRun([...rows, { date: "2026-11-25", status: "late" }]).count, 0, "came back: the run ends");
  assert.equal(R.absenceRun([]).count, 0);
});

test("a reason opens a case only when none is open and none closed in the last week", () => {
  assert.equal(R.mayOpen({ openExists: false, lastClosedAt: null, today: "2026-11-26" }), true);
  assert.equal(R.mayOpen({ openExists: true, lastClosedAt: null, today: "2026-11-26" }), false);
  assert.equal(R.mayOpen({ openExists: false, lastClosedAt: "2026-11-24T10:00:00Z", today: "2026-11-26" }), false);
  assert.equal(R.mayOpen({ openExists: false, lastClosedAt: "2026-11-18T10:00:00Z", today: "2026-11-26" }), true);
});

test("the re-check closes a case whose reason has gone and checks a still-flagged one again", () => {
  assert.deepEqual(R.recheckOutcome({ stillFlagged: false, today: "2026-11-26" }), { status: "resolved", recheckOn: null, outcome: "back_on_track" });
  assert.deepEqual(R.recheckOutcome({ stillFlagged: true, today: "2026-11-26" }), { status: null, recheckOn: "2026-12-10", outcome: null });
});

test("statuses: a closed case stays closed; overdue only while open", () => {
  assert.equal(R.statusProblem("open", "contacted"), null);
  assert.match(R.statusProblem("resolved", "open"), /closed/);
  assert.ok(R.statusProblem("open", "nonsense"));
  assert.equal(R.isOverdue({ status: "open", dueOn: "2026-11-20" }, "2026-11-26"), true);
  assert.equal(R.isOverdue({ status: "resolved", dueOn: "2026-11-20" }, "2026-11-26"), false);
  assert.equal(R.isOverdue({ status: "contacted", dueOn: "2026-11-30" }, "2026-11-26"), false);
});

test("every reason has a summary and a parent message, in plain words", () => {
  const details = { score: 32, pieces: 4, rate: 60, days: 10, missed: 3, lastSignIn: "2026-11-01", count: 3, dates: ["2026-11-09"], competencyName: "Problem solving", percent: 30, reports: 2, note: "Mum called the hub" };
  for (const key of R.REASON_KEYS) {
    assert.ok(R.REASONS[key].summary(details).length > 3, key);
    const msg = R.suggestedMessage(key, { first: "Amani", parent: "Mary Wanjiku", className: "Clicker", details });
    assert.ok(msg.startsWith("Hello Mary,"), key);
    assert.ok(!msg.includes("—"), `${key}: no long dashes`);
  }
  assert.match(R.REASONS.absenceStreak.summary({ count: 3, dates: ["2026-11-09"] }), /Absent the last 3 sessions \(9 Nov\)/);
});
