// Family credits — the rules that need no database (modules/family-credits/credit.rules.js).
// 1 credit = KSh 1; any of a parent's children may book a mentor with them unless the parent has
// switched that child off or set a monthly limit; a cancelled booking's credits go back.
const test = require("node:test");
const assert = require("node:assert/strict");
const R = require("../src/modules/family-credits/credit.rules");
const MB = require("../src/modules/mentor-bookings/mentor-booking.rules");

const settings = R.cleanCreditSettings({});

test("credit settings default on, with sensible amounts", () => {
  assert.equal(settings.creditsEnabled, true);
  assert.equal(settings.childBooking, true);
  assert.equal(settings.minimumPurchase, 100);
  assert.deepEqual(settings.creditPresets, [500, 1000, 2000, 5000]);
  const custom = R.cleanCreditSettings({ creditsEnabled: false, minimumPurchase: 300, creditPresets: [200, 1000, 1000, 400, "x"] });
  assert.equal(custom.creditsEnabled, false);
  assert.deepEqual(custom.creditPresets, [400, 1000]); // below the minimum and repeats dropped
});

test("they travel with the mentor booking settings", () => {
  const { settings: s } = MB.cleanSettings({ childBooking: false, minimumPurchase: 250 });
  assert.equal(s.childBooking, false);
  assert.equal(s.minimumPurchase, 250);
  assert.equal(s.creditsEnabled, true);
});

test("buying: whole credits from the minimum, only while credits are on", () => {
  assert.equal(R.purchaseProblem(1000, settings), null);
  assert.match(R.purchaseProblem(50, settings), /least/);
  assert.match(R.purchaseProblem(10.5, settings), /whole/);
  assert.match(R.purchaseProblem(1000, { ...settings, creditsEnabled: false }), /aren't on/);
  assert.match(R.purchaseProblem(500000, settings), /most/);
});

test("a child may book unless switched off; a monthly limit caps them", () => {
  assert.deepEqual(R.ruleFor({}, "k1"), { allowed: true, monthlyLimit: null });
  assert.deepEqual(R.ruleFor({ k1: { allowed: false, monthlyLimit: "1500" } }, "k1"), { allowed: false, monthlyLimit: 1500 });
  const rule = { allowed: true, monthlyLimit: 2000 };
  assert.equal(R.childSpendCheck({ settings, rule, balance: 5000, amount: 1500, spentThisMonth: 0 }).ok, true);
  const over = R.childSpendCheck({ settings, rule, balance: 5000, amount: 1500, spentThisMonth: 1000 });
  assert.equal(over.ok, false);
  assert.equal(over.left, 1000);
  assert.match(over.reason, /this month/);
  assert.match(R.childSpendCheck({ settings, rule: { allowed: true, monthlyLimit: null }, balance: 800, amount: 1500 }).reason, /ask your parent/i);
  assert.match(R.childSpendCheck({ settings, rule: { allowed: false, monthlyLimit: null }, balance: 9000, amount: 100 }).reason, /hasn't switched on/);
  assert.equal(R.childSpendCheck({ settings: { ...settings, childBooking: false }, rule, balance: 9000, amount: 100 }).ok, false);
});

test("a refund puts credits back first; only money paid otherwise is due", () => {
  assert.deepEqual(R.splitRefund(1500, 1500), { credits: 1500, money: 0 });
  assert.deepEqual(R.splitRefund(2000, 500), { credits: 500, money: 1500 });
  assert.deepEqual(R.splitRefund(0, 500), { credits: 0, money: 0 });
  assert.deepEqual(R.splitRefund(1000, 0), { credits: 0, money: 1000 });
});

test("the month starts at midnight in Kenya", () => {
  const start = R.kenyaMonthStart(new Date("2026-12-01T00:30:00Z")); // 03:30 on 1 Dec in Nairobi
  assert.equal(start.toISOString(), "2026-11-30T21:00:00.000Z");
});
