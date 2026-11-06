// Written questions can't be handed in blank (grading.utils.js's unansweredWrittenItems).
const test = require("node:test");
const assert = require("node:assert/strict");
const { unansweredWrittenItems, questionList } = require("../src/modules/assessments/submissions/grading.utils");

const quiz = {
  type: "quiz",
  items: [
    { id: "q1", kind: "mcqSingle" },
    { id: "q2", kind: "shortAnswer" },
    { id: "q3", kind: "essay" },
    { id: "q4", kind: "imageUpload" },
  ],
};

test("blank written questions are found, numbered as the learner sees them", () => {
  assert.deepEqual(unansweredWrittenItems(quiz, []), [{ itemId: "q2", number: 2 }, { itemId: "q3", number: 3 }]);
  assert.deepEqual(unansweredWrittenItems(quiz, [{ itemId: "q2", response: "   " }, { itemId: "q3", response: "My answer" }]), [{ itemId: "q2", number: 2 }]);
  assert.deepEqual(unansweredWrittenItems(quiz, [{ itemId: "q2", response: "a" }, { itemId: "q3", response: "b" }]), []);
});

test("only written questions count; a survey's open questions stay optional", () => {
  assert.deepEqual(unansweredWrittenItems({ type: "quiz", items: [{ id: "a", kind: "mcqSingle" }, { id: "b", kind: "imageUpload" }] }, []), []);
  assert.deepEqual(unansweredWrittenItems({ type: "survey", items: [{ id: "a", kind: "openEnded" }] }, []), []);
});

test("the message names the questions", () => {
  assert.equal(questionList([2]), "question 2");
  assert.equal(questionList([2, 5]), "questions 2 and 5");
  assert.equal(questionList([1, 3, 4]), "questions 1, 3 and 4");
});
