const test = require("node:test");
const assert = require("node:assert/strict");

// Can-do checks ("I can do it independently / with help / I can't do it"): marked automatically
// from the level the learner picks — see grading.utils.js and builder.constants.js's CAN_DO_LEVELS.
const {
  gradeItem, computeAutoScore, requiresManualGrading, computeIndicatorBreakdown, computeMaxScore,
} = require("../src/modules/assessments/submissions/grading.utils");
const { CAN_DO_LEVELS } = require("../src/modules/assessments/builder.constants");

const canDo = (id, points = 2, extra = {}) => ({ id, kind: "canDo", question: "<p>I can write a loop</p>", points, ...extra });

test("each level earns its share of the marks", () => {
  const item = canDo("a", 4);
  assert.deepEqual(gradeItem(item, "independent"), { correct: true, marksAwarded: 4, maxMarks: 4, level: "independent" });
  assert.deepEqual(gradeItem(item, "withHelp"), { correct: false, marksAwarded: 2, maxMarks: 4, level: "withHelp" });
  assert.deepEqual(gradeItem(item, "cannot"), { correct: false, marksAwarded: 0, maxMarks: 4, level: "cannot" });
  // No answer, or one that isn't a level, earns nothing.
  assert.equal(gradeItem(item, undefined).marksAwarded, 0);
  assert.equal(gradeItem(item, "I can do it independently").marksAwarded, 0, "the wording isn't the answer — the key is");
  // Half of an odd mark keeps one decimal place.
  assert.equal(gradeItem(canDo("b", 1), "withHelp").marksAwarded, 0.5);
});

test("the levels are fixed: full, half, none", () => {
  assert.deepEqual(CAN_DO_LEVELS.map((l) => [l.key, l.credit]), [["independent", 1], ["withHelp", 0.5], ["cannot", 0]]);
});

test("a quiz of can-do checks is marked on submit, without a teacher", () => {
  const assessment = { type: "quiz", items: [canDo("a", 2), canDo("b", 2), canDo("c", 1)] };
  assert.equal(requiresManualGrading(assessment), false);
  const { autoScore, autoMax, itemResults } = computeAutoScore(assessment, [
    { itemId: "a", response: "independent" },
    { itemId: "b", response: "withHelp" },
    { itemId: "c", response: "cannot" },
  ]);
  assert.equal(autoScore, 3);
  assert.equal(autoMax, 5);
  assert.equal(computeMaxScore(assessment), 5);
  assert.deepEqual(itemResults.map((r) => r.level), ["independent", "withHelp", "cannot"]);
});

test("in a survey a can-do check carries no marks", () => {
  const assessment = { type: "survey", items: [canDo("a", 2)] };
  assert.deepEqual(computeAutoScore(assessment, [{ itemId: "a", response: "independent" }]), { autoScore: 0, autoMax: 0, itemResults: [] });
  assert.equal(computeMaxScore(assessment), 0);
});

test("a tagged indicator gets the level's share of its marks", () => {
  const assessment = {
    type: "quiz",
    items: [
      canDo("a", 0, { indicatorMarks: [{ indicatorId: "loops", marks: 2 }] }),
      canDo("b", 0, { indicatorMarks: [{ indicatorId: "loops", marks: 2 }, { indicatorId: "debug", marks: 2 }] }),
    ],
  };
  const { itemResults } = computeAutoScore(assessment, [
    { itemId: "a", response: "independent" },
    { itemId: "b", response: "withHelp" },
  ]);
  const breakdown = Object.fromEntries(computeIndicatorBreakdown(assessment, itemResults, []).map((b) => [b.indicatorId, b]));
  assert.deepEqual(breakdown.loops, { indicatorId: "loops", marksEarned: 3, marksPossible: 4 });
  assert.deepEqual(breakdown.debug, { indicatorId: "debug", marksEarned: 1, marksPossible: 2 });
});

test("a project with can-do checks still goes to the teacher, with the checks already marked", () => {
  const assessment = { type: "project", items: [canDo("a", 2)], deliverables: [{ id: "d1" }] };
  assert.equal(requiresManualGrading(assessment), true);
  assert.equal(computeAutoScore(assessment, [{ itemId: "a", response: "withHelp" }]).autoScore, 1);
});
