// Expenses — the rules that need no database (modules/expenses/expense.rules.js): where a claim
// goes, its totals, and who may decide or pay. (Since 18 Nov 2026 nothing about a line is checked
// when a claim is sent, and reviewers see no flags — the user's choice.)
const test = require("node:test");
const assert = require("node:assert/strict");
const R = require("../src/modules/expenses/expense.rules");
const { decisionSchema, paySchema, claimSchema, settingsSchema } = require("../src/modules/expenses/expense.validation");

test("a claim goes to an educator's supervisor first, else to the approvers", () => {
  assert.equal(R.routeFor({ claimantRole: "teacher", supervisorId: "s1" }), "pending_supervisor");
  assert.equal(R.routeFor({ claimantRole: "teacher", supervisorId: null }), "pending_admin");
  assert.equal(R.routeFor({ claimantRole: "collaborator", supervisorId: "s1" }), "pending_admin");
  assert.equal(R.routeFor({ claimantRole: "admin" }), "pending_admin");
  assert.equal(R.routeFor({ claimantRole: "supervisor" }), "pending_admin");
});

test("M-Pesa codes are tidied as typed, never checked", () => {
  assert.equal(R.normaliseMpesaCode(" sgh7 k2lm-3p "), "SGH7K2LM3P");
  assert.equal(R.normaliseMpesaCode("abc"), "ABC");
  assert.equal(R.normaliseMpesaCode(""), null);
});

test("totals: all lines, and the lines still standing", () => {
  const t = R.totalsOf([{ amount: 2000 }, { amount: 650.5, status: "rejected" }, { amount: "200" }]);
  assert.deepEqual(t, { total: 2850.5, approved: 2200 });
});

test("nobody approves their own claim — unless they are the only approver", () => {
  const admin = { userId: "u1", role: "admin", canApprove: true };
  const staffView = { userId: "u2", role: "admin", canApprove: false };
  const pending = { status: "pending_admin", claimantUserId: "u1" };
  assert.equal(R.canDecide(pending, admin), false);
  assert.equal(R.canDecide(pending, admin, { soleApprover: true }), true);
  assert.equal(R.canDecide({ ...pending, claimantUserId: "u9" }, admin), true);
  assert.equal(R.canDecide({ ...pending, claimantUserId: "u9" }, staffView), false);
});

test("a supervisor decides only the claims sent to them, and never pays", () => {
  const sup = { userId: "s1", role: "supervisor", canApprove: false };
  const claim = { status: "pending_supervisor", claimantUserId: "t1", supervisorId: "s1" };
  assert.equal(R.canDecide(claim, sup), true);
  assert.equal(R.canDecide({ ...claim, supervisorId: "s2" }, sup), false);
  assert.equal(R.canDecide({ ...claim, status: "pending_admin" }, sup), false);
  assert.equal(R.canPay({ ...claim, status: "approved" }, sup), false);
  // An approver may step in for a supervisor.
  assert.equal(R.canDecide(claim, { userId: "a1", role: "admin", canApprove: true }), true);
});

test("only an approved claim is paid", () => {
  const admin = { userId: "a1", role: "admin", canApprove: true };
  assert.equal(R.canPay({ status: "approved", claimantUserId: "t1" }, admin), true);
  assert.equal(R.canPay({ status: "pending_admin", claimantUserId: "t1" }, admin), false);
  assert.equal(R.canPay({ status: "paid", claimantUserId: "t1" }, admin), false);
});

test("settings keep categories, switched-off ones too", () => {
  const s = R.settingsOf({ categories: [{ key: "fuel", label: "Fuel" }, { key: "x", label: "X", active: false }] });
  assert.equal(s.categories.length, 2);
  assert.equal(s.categories[1].active, false);
  assert.equal(R.settingsOf(null).categories.length, R.DEFAULT_CATEGORIES.length);
  assert.equal(settingsSchema.safeParse({ categories: [] }).success, false);
  assert.equal(settingsSchema.safeParse({ categories: [{ key: "fuel", label: "Fuel" }] }).success, true);
});

test("decisions need reasons where it matters", () => {
  assert.equal(decisionSchema.safeParse({ decision: "approve" }).success, true);
  assert.equal(decisionSchema.safeParse({ decision: "reject" }).success, false);
  assert.equal(decisionSchema.safeParse({ decision: "return", reason: "Receipt unreadable" }).success, true);
  assert.equal(decisionSchema.safeParse({ decision: "approve", lines: [{ id: "a", rejected: true }] }).success, false);
  assert.equal(paySchema.safeParse({ method: "mpesa", reference: "SGH7K2LM3P" }).success, true);
  assert.equal(paySchema.safeParse({ method: "card" }).success, false);
});

test("a claim needs a title and at least one complete line", () => {
  assert.equal(claimSchema.safeParse({ title: "Visit", items: [] }).success, false);
  assert.equal(claimSchema.safeParse({ title: "Visit", items: [{ spentOn: "2026-11-10", category: "fuel", description: "Fuel", amount: 0 }] }).success, false);
  const ok = claimSchema.parse({ title: "Visit", items: [{ spentOn: "2099-01-01", category: "fuel", description: "Fuel", amount: "2000", mpesaCode: "x" }] });
  assert.equal(ok.items[0].amount, 2000, "a future date and any M-Pesa text are accepted");
  assert.deepEqual(ok.items[0].fileIds, []);
  assert.equal(ok.hubId, null);
});
