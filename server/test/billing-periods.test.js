const test = require("node:test");
const assert = require("node:assert/strict");

// Package billing periods: which dates each invoice covers, its label and due date, and when a
// change of package or price takes effect — pure, no database (shared/utils/billing-periods.js).
const {
  addMonths, periodAt, nextPeriod, periodLabel, dueDateFor, scheduleChange, dueChange, onActivation, allowsPlans,
} = require("../src/shared/utils/billing-periods");

test("a month later keeps the day, held at a short month's end", () => {
  assert.equal(addMonths("2026-11-14", 1), "2026-12-14");
  assert.equal(addMonths("2026-01-31", 1), "2026-02-28");
  assert.equal(addMonths("2026-01-31", 2), "2026-03-31");
  assert.equal(addMonths("2026-11-30", 3), "2027-02-28");
  assert.equal(addMonths("2028-01-31", 1), "2028-02-29");
});

test("periods start on the day the family joins", () => {
  assert.deepEqual(periodAt("weekly", "2026-11-04", 0), { start: "2026-11-04", end: "2026-11-10" });
  assert.deepEqual(periodAt("weekly", "2026-11-04", 2), { start: "2026-11-18", end: "2026-11-24" });
  assert.deepEqual(periodAt("monthly", "2026-11-14", 0), { start: "2026-11-14", end: "2026-12-13" });
  assert.deepEqual(periodAt("monthly", "2026-01-31", 1), { start: "2026-02-28", end: "2026-03-30" });
  assert.deepEqual(periodAt("quarterly", "2026-11-14", 1), { start: "2027-02-14", end: "2027-05-13" });
  assert.deepEqual(periodAt("annually", "2026-11-14", 0), { start: "2026-11-14", end: "2027-11-13" });
});

test("the next period follows the last day billed", () => {
  const monthly = { billingPeriod: "monthly", billingAnchor: "2026-11-14" };
  assert.deepEqual(nextPeriod({ ...monthly, billedThrough: null }), { start: "2026-11-14", end: "2026-12-13" });
  assert.deepEqual(nextPeriod({ ...monthly, billedThrough: "2026-12-13" }), { start: "2026-12-14", end: "2027-01-13" });
  assert.deepEqual(nextPeriod({ ...monthly, billedThrough: "2028-03-13" }), { start: "2028-03-14", end: "2028-04-13" });
  const weekly = { billingPeriod: "weekly", billingAnchor: "2026-11-04" };
  assert.deepEqual(nextPeriod({ ...weekly, billedThrough: "2026-11-10" }), { start: "2026-11-11", end: "2026-11-17" });
  assert.deepEqual(nextPeriod({ ...weekly, billedThrough: "2027-11-02" }).start, "2027-11-03");
  // Existing families on calendar months carry on on calendar months.
  const calendar = { billingPeriod: "monthly", billingAnchor: "2026-09-01", billedThrough: "2026-10-31" };
  assert.deepEqual(nextPeriod(calendar), { start: "2026-11-01", end: "2026-11-30" });
});

test("a daily package is billed per calendar month, from the day it starts", () => {
  const daily = { billingPeriod: "daily", billingAnchor: "2026-11-14", billedThrough: null };
  assert.deepEqual(nextPeriod(daily), { start: "2026-11-14", end: "2026-11-30" });
  assert.deepEqual(nextPeriod({ ...daily, billedThrough: "2026-11-30" }), { start: "2026-12-01", end: "2026-12-31" });
});

test("labels read as a month, a year or a range", () => {
  assert.equal(periodLabel("2026-11-01", "2026-11-30"), "November 2026");
  assert.equal(periodLabel("2027-01-01", "2027-12-31"), "2027");
  assert.equal(periodLabel("2026-11-14", "2026-12-13"), "14 Nov – 13 Dec 2026");
  assert.equal(periodLabel("2026-12-28", "2027-01-03"), "28 Dec 2026 – 3 Jan 2027");
});

test("due a week after it's raised, by the period's end at the latest", () => {
  assert.equal(dueDateFor("monthly", "2026-11-14", "2026-12-13"), "2026-11-21");
  assert.equal(dueDateFor("weekly", "2026-11-14", "2026-11-17"), "2026-11-17");
  assert.equal(dueDateFor("daily", "2026-12-01", "2026-11-30"), "2026-12-08");
  // A period caught up after it ended: due the day it's raised.
  assert.equal(dueDateFor("monthly", "2027-01-15", "2026-11-30"), "2027-01-15");
});

test("a change of price or period waits for the next period", () => {
  const billed = { amount: 8000, billingPeriod: "monthly", billingAnchor: "2026-11-14", billedThrough: "2026-12-13", pendingBilling: null };
  assert.deepEqual(scheduleChange(billed, { amount: 8000, billingPeriod: "monthly" }), {});
  assert.deepEqual(scheduleChange(billed, { amount: 2500, billingPeriod: "weekly" }), {
    pendingBilling: { amount: 2500, billingPeriod: "weekly", from: "2026-12-14" },
  });
  // Nothing billed yet: straight away.
  assert.deepEqual(scheduleChange({ ...billed, billedThrough: null }, { amount: 2500, billingPeriod: "weekly" }), {
    amount: 2500, billingPeriod: "weekly", pendingBilling: null,
  });
  // Back to what it was: the waiting change is dropped.
  assert.deepEqual(scheduleChange({ ...billed, pendingBilling: { amount: 1, billingPeriod: "weekly", from: "2026-12-14" } }, { amount: 8000, billingPeriod: "monthly" }), { pendingBilling: null });
  // A daily month still running: the change starts next month.
  const daily = { amount: 500, billingPeriod: "daily", billingAnchor: "2026-11-01", billedThrough: "2026-11-30" };
  assert.equal(scheduleChange(daily, { amount: 8000, billingPeriod: "monthly" }).pendingBilling.from, "2027-01-01");
});

test("a waiting change applies once its day is reached", () => {
  const waiting = { amount: 8000, billingPeriod: "monthly", billingAnchor: "2026-11-14", pendingBilling: { amount: 2500, billingPeriod: "weekly", from: "2026-12-14" } };
  assert.equal(dueChange({ ...waiting, billedThrough: "2026-11-13" }), null);
  assert.deepEqual(dueChange({ ...waiting, billedThrough: "2026-12-13" }), {
    amount: 2500, billingPeriod: "weekly", billingAnchor: "2026-12-14", billedThrough: "2026-12-13", pendingBilling: null,
  });
  const priceOnly = { ...waiting, pendingBilling: { amount: 9000, billingPeriod: "monthly", from: "2026-12-14" }, billedThrough: "2026-12-13" };
  assert.deepEqual(dueChange(priceOnly), { amount: 9000, billingPeriod: "monthly", pendingBilling: null });
});

test("joining starts the periods; coming back starts them afresh, unbilled time away", () => {
  assert.deepEqual(onActivation({ status: "pending", billedThrough: null, startDate: null }, { today: "2026-11-14" }), { billingAnchor: "2026-11-14" });
  assert.deepEqual(onActivation({ status: "pending", billedThrough: null }, { today: "2026-11-14", startDate: "2026-11-20" }), { billingAnchor: "2026-11-20" });
  // A website sign-up already billed its first period: nothing changes on activation.
  assert.deepEqual(onActivation({ status: "pending", billedThrough: "2026-12-13" }, { today: "2026-11-20" }), {});
  assert.deepEqual(onActivation({ status: "paused", billedThrough: "2026-09-30", pendingBilling: null }, { today: "2026-11-14" }), {
    billingAnchor: "2026-11-14", billedThrough: "2026-11-13",
  });
  // Back before the paid period ran out: carries on as before.
  assert.deepEqual(onActivation({ status: "paused", billedThrough: "2026-12-13" }, { today: "2026-11-20" }), {});
});

test("part-payment plans only on a package invoice of about a quarter or more", () => {
  assert.equal(allowsPlans({ invoiceType: "bootcamp", periodStart: "2026-11-01", periodEnd: "2026-11-07" }), true);
  assert.equal(allowsPlans({ invoiceType: "home_learning", periodStart: "2026-11-14", periodEnd: "2026-12-13" }), false);
  assert.equal(allowsPlans({ invoiceType: "tech_club", periodStart: "2026-11-14", periodEnd: "2027-02-13" }), true);
});
