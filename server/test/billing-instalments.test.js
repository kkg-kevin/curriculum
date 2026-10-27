const test = require("node:test");
const assert = require("node:assert/strict");

// Part payments: splitting an invoice into a plan's parts, checking a typed schedule, where each
// part stands, and which reminder is owed — pure, no database (modules/billing/billing.instalments.js).
const { scheduleFromPlan, scheduleProblems, partStates, paymentPosition, reminderFor } = require("../src/modules/billing/billing.instalments");

test("a plan with a deposit: the share first, the rest equal, a month apart", () => {
  const parts = scheduleFromPlan(12000, { count: 2, intervalMonths: 1, depositPercent: 50 }, "2026-10-28");
  assert.deepEqual(parts.map((p) => [p.label, p.amount, p.dueDate]), [["Deposit", 6000, "2026-10-28"], ["Payment 2", 6000, "2026-11-28"]]);
});

test("equal parts in whole shillings — the last takes the difference", () => {
  const parts = scheduleFromPlan(10000, { count: 3, intervalMonths: 1 }, "2026-01-31");
  assert.deepEqual(parts.map((p) => p.amount), [3333, 3333, 3334]);
  assert.deepEqual(parts.map((p) => p.dueDate), ["2026-01-31", "2026-02-28", "2026-03-31"]);
  assert.equal(scheduleFromPlan(2, { count: 3, intervalMonths: 1 }, "2026-01-01"), null); // too small to split
});

test("a typed schedule must be in date order and add up to the total", () => {
  assert.deepEqual(scheduleProblems([{ amount: 5000, dueDate: "2026-11-01" }, { amount: 5000, dueDate: "2026-12-01" }], 10000), []);
  assert.match(scheduleProblems([{ amount: 5000, dueDate: "2026-11-01" }], 5000)[0], /at least 2/);
  assert.match(scheduleProblems([{ amount: 4000, dueDate: "2026-11-01" }, { amount: 5000, dueDate: "2026-12-01" }], 10000).join(), /add up to 9,000/);
  assert.match(scheduleProblems([{ amount: 5000, dueDate: "2026-12-01" }, { amount: 5000, dueDate: "2026-11-01" }], 10000).join(), /due before/);
  assert.match(scheduleProblems([{ amount: 0, dueDate: "2026-11-01" }, { amount: 10000, dueDate: "" }], 10000).join(), /above 0.*due date/);
});

test("payments count towards the earliest part first", () => {
  const parts = [
    { sequence: 1, label: "Deposit", amount: 6000, dueDate: "2026-10-01" },
    { sequence: 2, label: "Payment 2", amount: 3000, dueDate: "2026-11-01" },
    { sequence: 3, label: "Payment 3", amount: 3000, dueDate: "2026-12-01" },
  ];
  const states = partStates(parts, 7000, "2026-11-01");
  assert.deepEqual(states.map((p) => [p.paid, p.remaining, p.state, p.partPaid]), [[6000, 0, "paid", false], [1000, 2000, "due", true], [0, 3000, "upcoming", false]]);
  const late = paymentPosition({ total: 12000 }, parts, 7000, "2026-11-10");
  assert.equal(late.overdueAmount, 2000);
  assert.equal(late.overdueSince, "2026-11-01");
  assert.equal(late.daysOverdue, 9);
  assert.deepEqual(late.next, { sequence: 2, label: "Payment 2", amount: 2000, dueDate: "2026-11-01", state: "overdue" });
});

test("no schedule: the whole invoice, due on its due date — never overdue without one", () => {
  const due = paymentPosition({ total: 5000, dueAt: "2026-10-20T00:00:00Z" }, [], 1000, "2026-10-25");
  assert.equal(due.hasSchedule, false);
  assert.equal(due.overdueAmount, 4000);
  const noDate = paymentPosition({ total: 5000, dueAt: null }, [], 0, "2026-10-25");
  assert.equal(noDate.overdueAmount, 0);
  assert.equal(noDate.next.state, "upcoming");
});

test("one reminder per milestone: ahead, on the day, the day after, when grace runs out", () => {
  const part = { dueDate: "2026-11-10", remaining: 500 };
  const at = (today) => reminderFor(part, today, { daysBefore: 3, graceDays: 7 });
  assert.equal(at("2026-11-07"), "upcoming");
  assert.equal(at("2026-11-08"), null);
  assert.equal(at("2026-11-10"), "due");
  assert.equal(at("2026-11-11"), "overdue");
  assert.equal(at("2026-11-17"), "final");
  assert.equal(at("2026-11-20"), null);
  assert.equal(reminderFor({ ...part, remaining: 0 }, "2026-11-10"), null);
});
