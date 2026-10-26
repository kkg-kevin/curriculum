const { computeEntryMarks, roundMarks } = require("../assessment.utils");
const { CAN_DO_LEVELS } = require("../builder.constants");

// Item kinds marked automatically from the learner's answer: the ones with a single, unambiguous
// correct answer stored on the item itself, and can-do checks (marked by the level the learner
// picks). Everything else (free text, uploads, observation indicators, rubric-graded work) needs
// a human to score it.
const AUTO_GRADABLE_KINDS = ["mcqSingle", "mcqMultiple", "trueFalse", "matching", "ordering", "fillBlank", "canDo"];

function isAutoGradableItem(item) {
  return AUTO_GRADABLE_KINDS.includes(item.kind);
}

// Whether any part of this assessment needs a teacher's eyes before it can be released — a
// rubric, a project type, or a single non-auto-gradable item is enough to hold the whole
// submission for manual review (see the release-together decision this was built around).
// Teacher Observation authors real items exactly like quiz/exam (structured/unstructured) plus
// its own `indicators` (checklist/rating/etc, always filled in by the teacher during grading,
// never auto-gradable) — any indicators present force manual grading the same way a rubric does.
function requiresManualGrading(assessment) {
  // A survey is a self-reflection, never a graded artifact — a learner's own rating of their
  // understanding has no "correct" answer for a teacher to review, so it always releases
  // immediately on submit (see assessment-submission.service.js's submit()) rather than sitting
  // in a "needs grading" queue like every other type's non-auto-gradable items would.
  if (assessment.type === "survey") return false;
  if (assessment.type === "project") return true;
  if ((assessment.rubric || []).length > 0) return true;
  if ((assessment.indicators || []).length > 0) return true;
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
    case "canDo": {
      // Partial credit: the share of the marks the chosen level earns ("with help" = half).
      // No answer, or an unknown one, earns nothing. `level` is kept on the result for display.
      const level = CAN_DO_LEVELS.find((l) => l.key === response);
      const credit = level ? level.credit : 0;
      return { correct: credit === 1, marksAwarded: roundMarks(maxMarks * credit), maxMarks, level: level ? level.key : null };
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

  // A survey is never scored (see computeMaxScore) — a can-do check in one keeps its answer
  // (on the submission's answers) but earns no marks.
  if (assessment.type === "survey") return { autoScore, autoMax, itemResults };

  items.forEach((item) => {
    if (!isAutoGradableItem(item)) return;
    const response = answersByItem.get(item.id);
    const { correct, marksAwarded, maxMarks, level } = gradeItem(item, response);
    autoScore += marksAwarded;
    autoMax += maxMarks;
    itemResults.push({ itemId: item.id, correct, marksAwarded, maxMarks, ...(level !== undefined ? { level } : {}) });
  });

  return { autoScore: roundMarks(autoScore), autoMax: roundMarks(autoMax), itemResults };
}

// Total possible marks across the whole assessment — items plus (for observation) indicators,
// plus rubric, the same accounting AssessmentContent.jsx already surfaces to a teacher/admin.
// Every observation kind counts, a "note" included (since 26 Oct 2026 a note is marked and
// tagged like the rest; notes written before then were set to 0 marks, so their totals held).
function computeMaxScore(assessment) {
  // No possible score for a survey — a self-rating isn't "worth" marks (see
  // requiresManualGrading above for the matching "never needs grading" side of this).
  if (assessment.type === "survey") return 0;
  const entries = [
    ...(assessment.items || []),
    ...(assessment.type === "observation" ? (assessment.indicators || []) : []),
  ];
  const itemMax = entries.reduce((sum, e) => sum + computeEntryMarks(e), 0);
  const rubricMax = (assessment.rubric || []).reduce((sum, c) => sum + computeEntryMarks(c), 0);
  // A project's milestones (see gradeMilestone in assessment-submission.service.js) are graded
  // independently of items/rubric — included here so a project's maxScore reflects its full
  // possible total from the moment the submission is created, not just once milestones exist.
  const milestoneMax = (assessment.milestones || []).reduce((sum, m) => sum + computeEntryMarks(m), 0);
  return roundMarks(itemMax + rubricMax + milestoneMax);
}

// Resolves each item's/rubric criterion's indicatorMarks (marks tagged per competency
// indicator, authored via IndicatorPicker) against how much of it was actually earned — the
// per-submission "competency reflection" feeding both the per-assessment breakdown a learner
// sees and the accumulating per-learner indicator progress. Untagged items (plain `points`,
// no indicatorMarks) contribute nothing — there's no indicator to attribute them to.
//
// Auto-graded items are exact: an indicator's tagged share counts by the share of the item's
// marks earned — all or nothing for a right/wrong question, the level's share for a can-do check
// ("with help" earns half of each tagged indicator's marks). Manually-graded
// items/rubric use whatever per-indicator split the teacher entered in their feedback
// (itemFeedbackSchema's indicatorMarks — see GradingPanel.jsx); if a submission was graded
// before that existed, or a teacher skipped the split, this falls back to apportioning the
// flat marks proportionally by each indicator's tagged share rather than losing the entry.
function computeIndicatorBreakdown(assessment, autoItemResults, itemFeedback) {
  const autoByItem = new Map((autoItemResults || []).map((r) => [r.itemId, r]));
  const feedbackByKey = new Map((itemFeedback || []).map((f) => [f.itemId, f]));
  const totals = new Map();

  function add(indicatorId, earned, possible) {
    const cur = totals.get(indicatorId) || { marksEarned: 0, marksPossible: 0 };
    cur.marksEarned += earned;
    cur.marksPossible += possible;
    totals.set(indicatorId, cur);
  }

  function applyEntry(entry, feedbackKey) {
    const indicatorMarks = entry.indicatorMarks || [];
    if (indicatorMarks.length === 0) return;

    const auto = autoByItem.get(entry.id);
    if (auto) {
      const ratio = auto.maxMarks > 0 ? auto.marksAwarded / auto.maxMarks : 0;
      indicatorMarks.forEach(({ indicatorId, marks }) => add(indicatorId, (Number(marks) || 0) * ratio, Number(marks) || 0));
      return;
    }

    const feedback = feedbackByKey.get(feedbackKey);
    const feedbackIndicatorMarks = feedback?.indicatorMarks || [];
    if (feedbackIndicatorMarks.length > 0) {
      const earnedById = new Map(feedbackIndicatorMarks.map((m) => [m.indicatorId, Number(m.marks) || 0]));
      indicatorMarks.forEach(({ indicatorId, marks }) => add(indicatorId, earnedById.get(indicatorId) || 0, Number(marks) || 0));
      return;
    }

    const possibleTotal = computeEntryMarks(entry);
    const earnedTotal = Number(feedback?.marks) || 0;
    const ratio = possibleTotal > 0 ? earnedTotal / possibleTotal : 0;
    indicatorMarks.forEach(({ indicatorId, marks }) => add(indicatorId, (Number(marks) || 0) * ratio, Number(marks) || 0));
  }

  (assessment.items || []).forEach((item) => applyEntry(item, item.id));
  (assessment.rubric || []).forEach((c) => applyEntry(c, `rubric:${c.id}`));
  // Observation indicators — every kind, a note included — score through the exact same
  // applyEntry path as items/rubric.
  (assessment.indicators || []).forEach((ind) => applyEntry(ind, ind.id));

  return [...totals.entries()].map(([indicatorId, { marksEarned, marksPossible }]) => ({
    indicatorId,
    marksEarned: Math.round(marksEarned * 100) / 100,
    marksPossible,
  }));
}

// A class-issued submission is graded internally (status "graded") as soon as a teacher saves
// marks, but stays hidden from the learner until the teacher separately calls publishReport (see
// assessment-submission.service.js) — presented here as still "submitted" so every existing
// learner-facing UI, which only ever branches on status, needs no changes to respect the gate.
// Only ever applied for the "learner" role — admin/school/teacher always see the real state.
function redactUnpublishedReport(submission) {
  if (submission.status !== "graded" || submission.reportPublished) return submission;
  return {
    ...submission,
    status: "submitted",
    totalScore: null,
    autoScore: null,
    manualScore: null,
    autoItemResults: [],
    itemFeedback: [],
    overallFeedback: "",
    indicatorBreakdown: [],
    gradedAt: null,
    gradedBy: null,
  };
}

module.exports = {
  redactUnpublishedReport,
  AUTO_GRADABLE_KINDS,
  isAutoGradableItem,
  requiresManualGrading,
  gradeItem,
  computeAutoScore,
  computeMaxScore,
  computeIndicatorBreakdown,
};
