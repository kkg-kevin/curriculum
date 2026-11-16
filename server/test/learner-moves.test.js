// Moving a learner between programmes — the rules that need no database
// (modules/learner-moves/learner-move.rules.js).
const test = require("node:test");
const assert = require("node:assert/strict");
const R = require("../src/modules/learner-moves/learner-move.rules");

const TODAY = "2026-11-16";
const place = (key, programme, extra = {}) => ({ key, programme, status: "active", ...extra });

test("billing starts today or within the next year, never in the past", () => {
  assert.equal(R.startDateProblem("", TODAY), null);
  assert.equal(R.startDateProblem(TODAY, TODAY), null);
  assert.equal(R.startDateProblem("2027-01-05", TODAY), null);
  assert.match(R.startDateProblem("2026-11-15", TODAY), /past/);
  assert.match(R.startDateProblem("2028-01-01", TODAY), /next year/);
  assert.match(R.startDateProblem("16/11/2026", TODAY), /Choose/);
});

test("a move needs a destination", () => {
  assert.deepEqual(R.moveProblems({ places: [], endKeys: [] }), ["Choose where they're moving to"]);
  assert.deepEqual(R.moveProblems({ destination: { programme: "school" } }), ["Choose where they're moving to"]);
});

test("only places they hold can be left", () => {
  const problems = R.moveProblems({ places: [place("hub:a", "hub")], endKeys: ["hub:b"], destination: { programme: "tech_club" } });
  assert.equal(problems.length, 1);
  assert.match(problems[0], /isn't theirs/);
});

test("moving into a place they keep is refused, into one they leave is fine", () => {
  const places = [place("club:m1", "tech_club")];
  assert.match(R.moveProblems({ places, endKeys: [], destination: { programme: "tech_club", sameAs: "club:m1" } })[0], /already in that membership/);
  assert.deepEqual(R.moveProblems({ places, endKeys: ["club:m1"], destination: { programme: "tech_club", sameAs: "club:m1" } }), []);
});

test("a new place at a hub where they already have one means leaving that one", () => {
  const places = [place("club:m1", "tech_club", { label: "Tech Club — Kilimani" })];
  const destination = { programme: "hub", hubClash: "club:m1" };
  assert.match(R.moveProblems({ places, endKeys: [], destination })[0], /already have a place there \(Tech Club — Kilimani\)/);
  assert.deepEqual(R.moveProblems({ places, endKeys: ["club:m1"], destination }), []);
});

test("a child already in Home Learning is moved within it on the Home Learning page", () => {
  const places = [place("hl:h1", "home_learning")];
  assert.match(R.moveProblems({ places, endKeys: [], destination: { programme: "home_learning" } })[0], /already in Home Learning/);
  assert.match(R.moveProblems({ places, endKeys: ["hl:h1"], destination: { programme: "home_learning" } })[0], /Home Learning page/);
  assert.deepEqual(R.moveProblems({ places: [place("hub:a", "hub")], endKeys: ["hub:a"], destination: { programme: "home_learning" } }), []);
});

test("a family record left with no child is offered to stop", () => {
  assert.equal(R.leavesEmpty(place("club:m", "tech_club", { activeChildren: 1 })), true);
  assert.equal(R.leavesEmpty(place("club:m", "tech_club", { activeChildren: 2 })), false);
  assert.equal(R.leavesEmpty(place("pathway:s", "pathway", { activeChildren: 1 })), true);
  assert.equal(R.leavesEmpty(place("hub:a", "hub", { activeChildren: 1 })), false);
});

test("leaving a pathway keeps the access already paid for, never more", () => {
  assert.equal(R.accessAfterLeaving({ rowAccessUntil: "2026-12-07", paidUntil: "2026-11-30", today: TODAY }), "2026-11-30");
  assert.equal(R.accessAfterLeaving({ rowAccessUntil: "2026-11-20", paidUntil: "2026-11-30", today: TODAY }), "2026-11-20");
  assert.equal(R.accessAfterLeaving({ rowAccessUntil: null, paidUntil: "2026-11-30", today: TODAY }), "2026-11-30");
  // Never paid: no access from today.
  assert.equal(R.accessAfterLeaving({ rowAccessUntil: null, paidUntil: null, today: TODAY }), "2026-11-15");
});

test("the move's note and whether their work carries on", () => {
  assert.equal(R.moveNote("Kilimani Hub · Grade 4", "Home Learning"), "Kilimani Hub · Grade 4 → Home Learning");
  assert.equal(R.moveNote(null, "Robotics pathway"), "Joined Robotics pathway");
  assert.equal(R.continuity({ fromCurriculumIds: ["c1"], toCurriculumId: "c1" }), "same");
  assert.equal(R.continuity({ fromCurriculumIds: ["c1"], toCurriculumId: "c2" }), "different");
  assert.equal(R.continuity({ fromCurriculumIds: [], toCurriculumId: null }), "unknown");
});

test("every programme has a label, and a module where staff need one", () => {
  for (const p of R.PROGRAMMES) {
    assert.ok(R.PROGRAMME_LABELS[p]);
    assert.ok(p in R.DESTINATION_MODULE);
  }
});
