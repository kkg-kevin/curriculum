// Removing a person — the rules that need no database (modules/removals/removal.rules.js): which
// step they're at, who an item goes to, and when delete may go ahead.
const test = require("node:test");
const assert = require("node:assert/strict");
const R = require("../src/modules/removals/removal.rules");
const { cantTeachReason } = require("../src/modules/teachers/teacher.validation");

const item = (key, extra = {}) => ({ key, label: key, ...extra });

test("steps run in order: deactivate → transfer → delete", () => {
  assert.equal(R.stepOf({}), "deactivate");
  assert.equal(R.stepOf({ deactivated: false, items: [item("a")] }), "deactivate");
  assert.equal(R.stepOf({ deactivated: true, items: [item("a")] }), "transfer");
  assert.equal(R.stepOf({ deactivated: true, toSettle: [{ label: "payout" }] }), "transfer");
  assert.equal(R.stepOf({ deactivated: true }), "delete");
  assert.equal(R.stepOf({ removed: true, deactivated: true, items: [item("a")] }), "done");
});

test("an item goes to its own choice, else the one person for everything", () => {
  const a = item("classCourse:1");
  assert.equal(R.assignmentFor(a, {}), null);
  assert.equal(R.assignmentFor(a, { to: "t2" }), "t2");
  assert.equal(R.assignmentFor(a, { to: "t2", overrides: { "classCourse:1": "t3" } }), "t3");
  assert.equal(R.assignmentFor(a, { to: "t2", overrides: { "classCourse:1": "" } }), "t2", "an empty choice falls back");
  assert.equal(R.assignmentFor(a, { to: null, overrides: { "other:9": "t3" } }), null);
});

test("who may take an item", () => {
  const plain = item("slot:1");
  const ctx = { candidateIds: ["t2", "t3"], selfId: "t1" };
  assert.equal(R.targetProblem(plain, "t2", ctx), null);
  assert.match(R.targetProblem(plain, null, ctx), /Choose who/);
  assert.match(R.targetProblem(plain, "t1", ctx), /being removed/);
  assert.match(R.targetProblem(plain, "t9", ctx), /from the list/);
  assert.match(R.targetProblem(plain, R.CANCEL, ctx), /can't be cancelled/);
  assert.match(R.targetProblem(plain, R.NOBODY, ctx), /Choose who/);
  assert.equal(R.targetProblem(item("booking:1", { canCancel: true }), R.CANCEL, ctx), null);
  assert.equal(R.targetProblem(item("educator:1", { allowNone: true }), R.NOBODY, ctx), null);
});

test("delete waits until they're deactivated and hold nothing", () => {
  assert.deepEqual(R.deleteBlockers({ deactivated: true }), []);
  assert.match(R.deleteBlockers({ deactivated: false }).join(" "), /Deactivate them first/);
  assert.match(R.deleteBlockers({ deactivated: true, items: [item("a")] }).join(" "), /the last thing/);
  assert.match(R.deleteBlockers({ deactivated: true, items: [item("a"), item("b")] }).join(" "), /the 2 things/);
  assert.match(R.deleteBlockers({ deactivated: true, toSettle: [{ label: "x" }] }).join(" "), /Sort out the item/);
});

test("inactive and removed educators can't be given new work", () => {
  assert.equal(cantTeachReason({ status: "active" }), null);
  assert.equal(cantTeachReason({ status: "on_leave" }), null);
  assert.equal(cantTeachReason({}), null);
  assert.match(cantTeachReason({ status: "in_training" }), /in training/);
  assert.match(cantTeachReason({ status: "inactive" }), /inactive/);
  assert.match(cantTeachReason({ status: "removed" }), /removed/);
});

test("counted", () => {
  assert.equal(R.counted(1, "class", "classes"), "1 class");
  assert.equal(R.counted(3, "class", "classes"), "3 classes");
});
