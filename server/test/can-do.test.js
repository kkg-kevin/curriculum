const test = require("node:test");
const assert = require("node:assert/strict");

// Can-do checks ("can do it independently / with help / can't yet"): since 20 Nov 2026 the
// EDUCATOR picks the level for each learner while marking (itemFeedback.level → canDoMarks); the
// learner doesn't answer them, except in a survey (no marks). See grading.utils.js and
// builder.constants.js's CAN_DO_LEVELS. gradeItem still reads a learner's older answer.
const {
  gradeItem, computeAutoScore, requiresManualGrading, computeIndicatorBreakdown, computeMaxScore, canDoMarks,
  applyCanDoLevels, unansweredWrittenItems, learnerItems,
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

test("can-do checks are the educator's to mark: never marked on submit", () => {
  const assessment = { type: "quiz", items: [canDo("a", 2), canDo("b", 2), canDo("c", 1)] };
  assert.equal(requiresManualGrading(assessment), true, "a quiz with can-do checks waits for the educator");
  // A learner's answers (older work) earn nothing automatically — no double counting once marked.
  const { autoScore, autoMax, itemResults } = computeAutoScore(assessment, [{ itemId: "a", response: "independent" }]);
  assert.deepEqual({ autoScore, autoMax, itemResults }, { autoScore: 0, autoMax: 0, itemResults: [] });
  assert.equal(computeMaxScore(assessment), 5, "they still count in the maximum");
});

test("the educator's level gives the marks: all, half, none", () => {
  const item = canDo("a", 4);
  assert.equal(canDoMarks(item, "independent"), 4);
  assert.equal(canDoMarks(item, "withHelp"), 2);
  assert.equal(canDoMarks(item, "cannot"), 0);
  assert.equal(canDoMarks(canDo("b", 1), "withHelp"), 0.5);
  assert.equal(canDoMarks(item, "maybe"), null);
});

test("in a survey a can-do check carries no marks", () => {
  const assessment = { type: "survey", items: [canDo("a", 2)] };
  assert.deepEqual(computeAutoScore(assessment, [{ itemId: "a", response: "independent" }]), { autoScore: 0, autoMax: 0, itemResults: [] });
  assert.equal(computeMaxScore(assessment), 0);
});

test("a tagged indicator gets the share of the marks the educator gave", () => {
  const assessment = {
    type: "quiz",
    items: [
      canDo("a", 0, { indicatorMarks: [{ indicatorId: "loops", marks: 2 }] }),
      canDo("b", 0, { indicatorMarks: [{ indicatorId: "loops", marks: 2 }, { indicatorId: "debug", marks: 2 }] }),
    ],
  };
  // Marked by the educator: "a" independently (2 of 2), "b" with help (2 of 4) — no split sent,
  // so each indicator gets its share of the item's marks.
  const feedback = [
    { itemId: "a", level: "independent", marks: canDoMarks(assessment.items[0], "independent"), indicatorMarks: [] },
    { itemId: "b", level: "withHelp", marks: canDoMarks(assessment.items[1], "withHelp"), indicatorMarks: [] },
  ];
  const breakdown = Object.fromEntries(computeIndicatorBreakdown(assessment, [], feedback).map((b) => [b.indicatorId, b]));
  assert.deepEqual(breakdown.loops, { indicatorId: "loops", marksEarned: 3, marksPossible: 4 });
  assert.deepEqual(breakdown.debug, { indicatorId: "debug", marksEarned: 1, marksPossible: 2 });
});

test("saving the marking: a can-do check's marks follow the level, and the total moves with them", () => {
  const assessment = { type: "project", items: [canDo("a", 4), canDo("b", 2), { id: "q", kind: "longAnswer", points: 5 }] };
  const sent = [
    { itemId: "a", level: "withHelp", marks: 4 },      // the page claimed 4 — with help is 2
    { itemId: "b", level: "independent", marks: 0 },   // the page sent 0 — independently is 2
    { itemId: "q", marks: 3 },                         // anything else is left as sent
  ];
  const { itemFeedback, manualScore } = applyCanDoLevels(assessment, sent, 7);
  assert.deepEqual(itemFeedback.map((f) => f.marks), [2, 2, 3]);
  assert.equal(manualScore, 7, "4 + 0 + 3 sent, worked out as 2 + 2 + 3");
  // No level picked yet: left alone (nothing for that check).
  assert.deepEqual(applyCanDoLevels(assessment, [{ itemId: "a", marks: 0 }], 0).itemFeedback[0], { itemId: "a", marks: 0 });
});

test("learners don't answer can-do checks (except in a survey) — question numbers skip them", () => {
  const items = [{ id: "c1", kind: "canDo" }, { id: "w1", kind: "longAnswer" }, { id: "c2", kind: "canDo" }, { id: "w2", kind: "shortAnswer" }];
  assert.deepEqual(learnerItems({ type: "quiz", items }).map((i) => i.id), ["w1", "w2"]);
  assert.equal(learnerItems({ type: "survey", items }).length, 4);
  // The blank written questions are numbered as the learner sees them: 1 and 2, not 2 and 4.
  assert.deepEqual(unansweredWrittenItems({ type: "quiz", items }, []).map((x) => x.number), [1, 2]);
});

test("a project with can-do checks goes to the educator, who marks the checks", () => {
  const assessment = { type: "project", items: [canDo("a", 2)], deliverables: [{ id: "d1" }] };
  assert.equal(requiresManualGrading(assessment), true);
  assert.equal(computeAutoScore(assessment, [{ itemId: "a", response: "withHelp" }]).autoScore, 0);
});
