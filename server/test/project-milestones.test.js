// A project's milestones in its score and skills (16 Nov 2026) — grading.utils.js.
const test = require("node:test");
const assert = require("node:assert/strict");
const G = require("../src/modules/assessments/submissions/grading.utils");

const project = (extra = {}) => ({
  type: "project",
  items: [],
  rubric: [{ id: "r1", criterion: "Build", points: 20 }],
  milestones: [
    { id: "m1", name: "Plan", points: 10 },
    { id: "m2", name: "Prototype", points: 0, indicatorMarks: [{ indicatorId: "i1", marks: 6 }, { indicatorId: "i2", marks: 4 }] },
    { id: "m3", name: "Show", points: 10 },
  ],
  ...extra,
});

test("the maximum counts the milestones (points, or indicator marks once tagged)", () => {
  assert.equal(G.computeMaxScore(project()), 50);
});

test("milestone marks earned: only marked ones, never more than each is worth", () => {
  const progress = [{ milestoneId: "m1", marks: 10 }, { milestoneId: "m2", marks: 99 }];
  assert.equal(G.milestoneEarned(project(), progress), 20); // 10 + 10 (capped), m3 not marked
  assert.equal(G.milestoneEarned(project(), []), 0);
  assert.equal(G.milestoneEarned({ type: "quiz" }, progress), 0);
  assert.equal(G.milestoneEarned(project(), [{ milestoneId: "gone", marks: 5 }]), 0);
});

test("a tagged milestone feeds its indicators by the share of its marks earned", () => {
  const rows = G.computeIndicatorBreakdown(project(), [], [], [{ milestoneId: "m2", marks: 5 }]);
  const byId = Object.fromEntries(rows.map((r) => [r.indicatorId, r]));
  assert.deepEqual(byId.i1, { indicatorId: "i1", marksEarned: 3, marksPossible: 6 });
  assert.deepEqual(byId.i2, { indicatorId: "i2", marksEarned: 2, marksPossible: 4 });
});

test("an unmarked tagged milestone still counts its possible marks (earned nothing)", () => {
  const rows = G.computeIndicatorBreakdown(project(), [], [], []);
  assert.equal(rows.find((r) => r.indicatorId === "i1").marksEarned, 0);
  assert.equal(rows.find((r) => r.indicatorId === "i1").marksPossible, 6);
});

test("a project with only milestones to mark is finished by its milestones", () => {
  assert.equal(G.nothingButMilestonesToMark(project()), false); // has a rubric
  assert.equal(G.nothingButMilestonesToMark(project({ rubric: [] })), true);
  assert.equal(G.nothingButMilestonesToMark(project({ rubric: [], items: [{ id: "q", kind: "canDo" }] })), true); // auto-marked
  assert.equal(G.nothingButMilestonesToMark(project({ rubric: [], items: [{ id: "q", kind: "longAnswer" }] })), false);
  assert.equal(G.nothingButMilestonesToMark(project({ rubric: [], milestones: [] })), false);
  assert.equal(G.nothingButMilestonesToMark({ type: "quiz", milestones: [{ id: "m" }] }), false);
});
