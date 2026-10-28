const test = require("node:test");
const assert = require("node:assert/strict");
const { gradeItem, correctOptionsOf } = require("../src/modules/assessments/submissions/grading.utils");

// Multiple Choice (Multiple): every right option ticked, and nothing else.

const item = (correctAnswer, options = ["Ultrasonic sensor", "Light bulb", "Line sensor", "Speaker"]) =>
  ({ kind: "mcqMultiple", points: 2, options, correctAnswer });

test("the right options are read from a list, or from the comma-joined text saved before", () => {
  assert.deepEqual(correctOptionsOf(item(["Ultrasonic sensor", "Line sensor"])), ["Ultrasonic sensor", "Line sensor"]);
  assert.deepEqual(correctOptionsOf(item("Ultrasonic sensor,Line sensor")), ["Ultrasonic sensor", "Line sensor"]);
  assert.deepEqual(correctOptionsOf(item("")), []);
  assert.deepEqual(correctOptionsOf(item([" Speaker ", "Speaker", ""])), ["Speaker"]);
});

test("ticking exactly the right options earns the marks, in any order", () => {
  for (const answers of [["Ultrasonic sensor", "Line sensor"], ["Line sensor", "Ultrasonic sensor"]]) {
    assert.equal(gradeItem(item(["Ultrasonic sensor", "Line sensor"]), answers).correct, true);
    assert.equal(gradeItem(item("Ultrasonic sensor,Line sensor"), answers).correct, true);
  }
});

test("too few, too many or wrong options earn nothing", () => {
  const right = item(["Ultrasonic sensor", "Line sensor"]);
  assert.equal(gradeItem(right, ["Ultrasonic sensor"]).correct, false);
  assert.equal(gradeItem(right, ["Ultrasonic sensor", "Line sensor", "Speaker"]).correct, false);
  assert.equal(gradeItem(right, ["Light bulb", "Speaker"]).correct, false);
  assert.equal(gradeItem(right, []).correct, false);
});

test("an option containing a comma can be a right answer", () => {
  const withComma = item(["Wheels, motors", "Battery"], ["Wheels, motors", "Battery", "Paper"]);
  assert.equal(gradeItem(withComma, ["Battery", "Wheels, motors"]).correct, true);
  assert.equal(gradeItem(withComma, ["Battery"]).correct, false);
});

test("an option typed with a space at the end still matches", () => {
  const spaced = item(["Line sensor"], ["Line sensor ", "Speaker"]);
  assert.equal(gradeItem(spaced, ["Line sensor "]).correct, true);
});

test("a question with no right option marked can't be answered correctly", () => {
  assert.equal(gradeItem(item([]), []).correct, false);
});
