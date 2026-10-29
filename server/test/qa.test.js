const test = require("node:test");
const assert = require("node:assert/strict");

// Quality assurance: tidying and checking a template, scoring a review, what a review needs before
// it's sent, and who may see a visit — pure, no database (modules/qa/qa.rules.js).
const {
  normaliseTemplate, templateProblems, scoreReview, reviewProblems, cleanAnswers, visitState, visibleToVisited,
} = require("../src/modules/qa/qa.rules");
const { DEFAULT_SCALE } = require("../src/modules/qa/qa.constants");

const template = normaliseTemplate({
  name: "  Classroom observation ",
  scale: DEFAULT_SCALE,
  sections: [
    {
      id: "s1",
      title: "Preparation",
      criteria: [
        { id: "c1", text: "Lesson plan ready", kind: "yes_no" },
        { id: "c2", text: "Materials set out", kind: "yes_no" },
      ],
    },
    {
      id: "s2",
      title: "Teaching",
      criteria: [
        { id: "c3", text: "Explains clearly", kind: "rubric", descriptors: { 4: "Every learner follows", 9: "not a level" } },
        { id: "c4", text: "Anything else", kind: "comment" },
      ],
    },
  ],
});

test("a template is tidied: trimmed, ids kept or made, only real levels described", () => {
  assert.equal(template.name, "Classroom observation");
  assert.equal(template.sections[0].id, "s1");
  assert.deepEqual(template.sections[1].criteria[0].descriptors, { 4: "Every learner follows" });
  // The description and guidance are rich text: kept as written, an empty editor kept as nothing.
  const rich = normaliseTemplate({ name: "x", description: "<p><strong>Read first</strong></p>", sections: [{ title: "A", criteria: [{ text: "B", kind: "yes_no", help: "<p></p>" }, { text: "C", kind: "yes_no", help: "<ul><li>Look at the plan</li></ul>" }] }] });
  assert.equal(rich.description, "<p><strong>Read first</strong></p>");
  assert.equal(rich.sections[0].criteria[0].help, null);
  assert.equal(rich.sections[0].criteria[1].help, "<ul><li>Look at the plan</li></ul>");
  const fresh = normaliseTemplate({ name: "x", sections: [{ title: "A", criteria: [{ text: "B", kind: "yes_no" }] }] });
  assert.match(fresh.sections[0].id, /^[0-9a-f-]{36}$/);
  assert.match(fresh.sections[0].criteria[0].id, /^[0-9a-f-]{36}$/);
});

test("a template names everything it's missing", () => {
  assert.deepEqual(templateProblems(template), []);
  const bad = normaliseTemplate({ name: "", scale: [{ score: 1, label: "Only" }], sections: [{ title: "", criteria: [{ text: "", kind: "rubric" }] }, { title: "Empty", criteria: [] }] });
  const problems = templateProblems(bad);
  assert.ok(problems.includes("Name the template"));
  assert.ok(problems.includes("A rubric needs at least two levels"));
  assert.ok(problems.includes("Give section 1 a title"));
  assert.ok(problems.includes('Add at least one thing to check in "Empty"'));
  const commentsOnly = normaliseTemplate({ name: "Notes", sections: [{ title: "A", criteria: [{ text: "Say something", kind: "comment" }] }] });
  assert.ok(templateProblems(commentsOnly).some((p) => p.includes("so the visit has a score")));
});

test("each scored item counts equally; not applicable is left out", () => {
  // yes (1) + no (0) → Preparation 50%; rubric 3 of 4 → Teaching 75%; overall (1 + 0 + 0.75) / 3.
  const { score, sectionScores } = scoreReview(template, { c1: { value: "yes" }, c2: { value: "no" }, c3: { value: 3 } });
  assert.equal(sectionScores[0].score, 50);
  assert.equal(sectionScores[1].score, 75);
  assert.equal(score, 58.3);
  const withNa = scoreReview(template, { c1: { value: "yes" }, c2: { value: "na" }, c3: { value: "na" } });
  assert.equal(withNa.score, 100);
  assert.equal(withNa.sectionScores[1].score, null);
  assert.equal(scoreReview(template, {}).score, null);
});

test("a review needs every scored item answered and the summary written before it's sent", () => {
  const problems = reviewProblems(template, { c1: { value: "yes" } }, { strengths: "<p></p>", improvements: "<p>More pace</p>" });
  assert.deepEqual(problems, ['Answer 1 item in "Preparation"', 'Answer 1 item in "Teaching"', "Write the strengths"]);
  assert.deepEqual(reviewProblems(template, { c1: { value: "na" }, c2: { value: "no" }, c3: { value: "4" } }, { strengths: "Warm", improvements: "Pace" }), []);
});

test("answers are kept only for the template's items, in each kind's shape", () => {
  const clean = cleanAnswers(template, {
    c1: { value: "maybe", comment: "  unsure " },
    c2: { value: "yes" },
    c3: { value: "7" },
    c4: { value: "yes", comment: "Good energy" },
    other: { value: "yes" },
  });
  assert.deepEqual(clean, { c1: { comment: "unsure" }, c2: { value: "yes" }, c4: { comment: "Good energy" } });
  assert.deepEqual(cleanAnswers(template, { c3: { value: "2" } }), { c3: { value: 2 } });
});

test("where a visit stands, and whether the educator and hub may see it", () => {
  const today = "2026-11-10";
  assert.equal(visitState({ status: "open", scheduledDate: "2026-11-12" }, today), "upcoming");
  assert.equal(visitState({ status: "open", scheduledDate: "2026-11-10" }, today), "due");
  assert.equal(visitState({ status: "submitted", scheduledDate: "2026-11-01" }, today), "submitted");
  assert.equal(visitState({ status: "cancelled", scheduledDate: "2026-11-01" }, today), "cancelled");

  assert.equal(visibleToVisited({ status: "open", visitType: "announced" }), true);
  assert.equal(visibleToVisited({ status: "open", visitType: "surprise" }), false, "a surprise stays hidden until the report is in");
  assert.equal(visibleToVisited({ status: "submitted", visitType: "surprise" }), true);
  assert.equal(visibleToVisited({ status: "cancelled", visitType: "announced" }), false);
});
