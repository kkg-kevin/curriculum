const { computeEntryMarks } = require("../assessment.utils");

// Item kinds with a single, unambiguous correct answer stored on the item itself — everything
// else (free text, uploads, observation indicators, rubric-graded work) needs a human to score it.
const AUTO_GRADABLE_KINDS = ["mcqSingle", "mcqMultiple", "trueFalse", "matching", "ordering", "fillBlank"];

function isAutoGradableItem(item) {
  return AUTO_GRADABLE_KINDS.includes(item.kind);
}

// Whether any part of this assessment needs a teacher's eyes before it can be released — a
// rubric, an observation/project type, or a single non-auto-gradable item is enough to hold the
// whole submission for manual review (see the release-together decision this was built around).
function requiresManualGrading(assessment) {
  if (assessment.type === "observation" || assessment.type === "project") return true;
  if ((assessment.rubric || []).length > 0) return true;
  return (assessment.items || []).some((item) => !isAutoGradableItem(item));
}

// Grades one learner response against an item's known-correct shape. Only ever called for
// AUTO_GRADABLE_KINDS — the response shape below is the contract the client's answer-capture
// UI must produce per kind.
function gradeItem(item, response) {
  const maxMarks = computeEntryMarks(item);
  let correct = false;

  switch (item.kind) {
    case "mcqSingle":
    case "trueFalse":
      correct = typeof response === "string" && response.trim() === (item.correctAnswer || "").trim();
      break;
    case "mcqMultiple": {
      // Stored as a comma-joined string of every right option (see McqField in
      // AssessmentTaker.jsx) — correct only if the learner picked exactly that set, order
      // notwithstanding.
      const correctSet = (item.correctAnswer || "").split(",").map((s) => s.trim()).filter(Boolean);
      const answerSet = (Array.isArray(response) ? response : []).map((s) => s.trim());
      correct = correctSet.length > 0 && answerSet.length === correctSet.length
        && correctSet.every((c) => answerSet.includes(c));
      break;
    }
    case "fillBlank": {
      const blanks = item.blanks || [];
      const answers = Array.isArray(response) ? response : [];
      correct = blanks.length > 0 && blanks.every((b, i) => (answers[i] || "").trim().toLowerCase() === (b || "").trim().toLowerCase());
      break;
    }
    case "ordering": {
      const seq = item.sequence || [];
      const answer = Array.isArray(response) ? response : [];
      correct = seq.length > 0 && seq.length === answer.length && seq.every((s, i) => s === answer[i]);
      break;
    }
    case "matching": {
      const pairs = item.pairs || [];
      const answer = Array.isArray(response) ? response : [];
      correct = pairs.length > 0 && answer.length === pairs.length
        && pairs.every((p) => answer.some((a) => a.left === p.left && a.right === p.right));
      break;
    }
    default:
      correct = false;
  }

  return { correct, marksAwarded: correct ? maxMarks : 0, maxMarks };
}

// Runs auto-grading across every auto-gradable item, given the learner's answers
// ([{itemId, response}]). Non-auto-gradable items are skipped — their marks come from the
// teacher's manual pass instead (see assessment-submission.service.js).
function computeAutoScore(assessment, answers) {
  const answersByItem = new Map((answers || []).map((a) => [a.itemId, a.response]));
  const items = assessment.items || [];
  let autoScore = 0;
  let autoMax = 0;
  const itemResults = [];

  items.forEach((item) => {
    if (!isAutoGradableItem(item)) return;
    const response = answersByItem.get(item.id);
    const { correct, marksAwarded, maxMarks } = gradeItem(item, response);
    autoScore += marksAwarded;
    autoMax += maxMarks;
    itemResults.push({ itemId: item.id, correct, marksAwarded, maxMarks });
  });

  return { autoScore, autoMax, itemResults };
}

// Total possible marks across the whole assessment — items (or indicators for observation) plus
// rubric, the same accounting AssessmentContent.jsx already surfaces to a teacher/admin.
function computeMaxScore(assessment) {
  const isObservation = assessment.type === "observation";
  const entries = (isObservation ? assessment.indicators : assessment.items) || [];
  const itemMax = !isObservation ? entries.reduce((sum, e) => sum + computeEntryMarks(e), 0) : 0;
  const rubricMax = (assessment.rubric || []).reduce((sum, c) => sum + computeEntryMarks(c), 0);
  return itemMax + rubricMax;
}

module.exports = {
  AUTO_GRADABLE_KINDS,
  isAutoGradableItem,
  requiresManualGrading,
  gradeItem,
  computeAutoScore,
  computeMaxScore,
};
