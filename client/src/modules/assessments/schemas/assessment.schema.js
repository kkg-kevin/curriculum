// Assessment schema & Builder registry. Mirrors server/src/modules/assessments/builder.constants.js
// and assessment.validation.js — single source of truth for the Assessment Builder UI.

export const ASSESSMENT_TYPES = ["quiz", "exam", "project", "assignment", "observation", "survey"];

export const STRUCTURE_MODES = ["structured", "unstructured", "mixed"];
export const STRUCTURE_MODE_LABELS = { structured: "Structured", unstructured: "Unstructured", mixed: "Mixed" };

export const STRUCTURED_ITEM_KINDS   = ["mcqSingle", "mcqMultiple", "trueFalse", "matching", "ordering", "fillBlank", "shortAnswer", "survey", "canDo"];
export const UNSTRUCTURED_ITEM_KINDS = ["longAnswer", "essay", "reflection", "scenarioResponse", "practicalTask", "openEnded"];
export const SUBMISSION_ITEM_KINDS   = ["documentUpload", "imageUpload", "videoUpload", "audioUpload", "codeUpload", "externalLink"];
export const OBSERVATION_ITEM_KINDS  = ["checklist", "rating", "note", "practicalSkill", "behaviour"];
// A survey's own questions (27 Oct 2026: surveys are built freely, like a form) — mirrors the
// server's builder.constants.js. Structured: a rating scale (its points worded per question),
// single choice, multiple choice (tick all that apply), short text and the can-do check. Open
// (unstructured): open-ended, long text and reflection. Nothing in a survey is marked, so a choice
// question has no correct answer.
export const SURVEY_ITEM_KINDS = ["survey", "mcqSingle", "mcqMultiple", "shortAnswer", "canDo"];
export const SURVEY_OPEN_KINDS = ["openEnded", "longAnswer", "reflection"];
// A "can-do" self-assessment (one of the structured items): the learner reads a statement and
// says how well they can do it. Marked automatically from the level picked — offered in every
// assessment type (in a Survey it carries no marks, like everything else there). Mirrors the
// server's CAN_DO_LEVELS.
// The levels in order, with the share of the question's marks each earns (fixed). The wording can
// be changed per question — an item's `levelLabels`, same order. A learner's answer is the key.
export const CAN_DO_LEVELS = [
  { key: "independent", credit: 1, label: "I can do it independently", color: "#059669", bg: "#ECFDF5", border: "#A7F3D0" },
  { key: "withHelp", credit: 0.5, label: "I can do it with help", color: "#B45309", bg: "#FFFBEB", border: "#FDE68A" },
  { key: "cannot", credit: 0, label: "I can't do it", color: "#6B7280", bg: "#F9FAFB", border: "#E5E7EB" },
];

// A can-do item's levels with its own wording (falling back to the standard wording).
export function canDoLevels(item) {
  return CAN_DO_LEVELS.map((level, i) => ({ ...level, label: item?.levelLabels?.[i]?.trim() || level.label }));
}

// The level a learner's answer (its key) stands for, or null.
export function canDoLevelFor(item, response) {
  return canDoLevels(item).find((level) => level.key === response) || null;
}

export const TASK_TYPES = ["written", "practical", "research"];
export const TASK_TYPE_LABELS = { written: "Written", practical: "Practical", research: "Research" };

export const DEFAULT_SURVEY_SCALE = ["Strongly Disagree", "Disagree", "Neutral", "Agree", "Strongly Agree"];

export const ITEM_KIND_LABELS = {
  mcqSingle: "Multiple Choice (Single)", mcqMultiple: "Multiple Choice (Multiple)", trueFalse: "True / False",
  matching: "Matching", ordering: "Ordering", fillBlank: "Fill in the Blank", shortAnswer: "Short Answer", survey: "Survey (Scale)",
  canDo: "Can-do Check (I can…)",
  longAnswer: "Long Answer", essay: "Essay", reflection: "Reflection", scenarioResponse: "Scenario Based",
  practicalTask: "Practical Task", openEnded: "Open-ended Question",
  documentUpload: "Document Upload", imageUpload: "Image Upload", videoUpload: "Video Upload",
  audioUpload: "Audio Upload", codeUpload: "Code Upload", externalLink: "External Link",
  checklist: "Checklist Item", rating: "Rating Item", note: "Observation Note",
  practicalSkill: "Practical Skill Observation", behaviour: "Behaviour Observation",
};

// Reuses the app's existing palette — no new colors introduced.
export const ITEM_GROUP_COLORS = { structured: "#25476a", unstructured: "#38aae1", submission: "#059669", observation: "#D97706", survey: "#7C3AED" };
export const ITEM_GROUP_LABELS = { structured: "Structured Items", unstructured: "Unstructured Items", submission: "Submission Items", observation: "Observation Items", survey: "Survey Questions" };

export const ITEM_GROUPS = {
  structured: STRUCTURED_ITEM_KINDS,
  unstructured: UNSTRUCTURED_ITEM_KINDS,
  submission: SUBMISSION_ITEM_KINDS,
  observation: OBSERVATION_ITEM_KINDS,
  survey: SURVEY_ITEM_KINDS,
};

// Which item-kind groups each assessment type's palette offers, and which extra content blocks it supports.
// `supportsQuestionRubric`: this type's questions/criteria can compound a single tagged
// indicator's marks from a checklist of sub-criteria (see ScoringCriteriaEditor in
// AssessmentBuilderPage.jsx and ScoringCriteriaChecklist in GradingPanel.jsx).
// `onlyKinds` narrows a group to some of its kinds for that type — a project's and a survey's
// Structured Items offer just the can-do check.
export const BUILDER_REGISTRY = {
  quiz:        { label: "Quiz", itemGroups: ["structured", "unstructured", "submission"], supportsSections: true },
  exam:        { label: "Exam", itemGroups: ["structured", "unstructured", "submission"], supportsSections: true },
  assignment:  { label: "Assignment", itemGroups: ["unstructured", "submission", "structured"], supportsSections: true, supportsTasks: true, supportsQuestionRubric: true },
  // A project's work is its deliverables, milestones and rubric; its only questions are can-do checks.
  project:     { label: "Project", itemGroups: ["structured"], onlyKinds: { structured: ["canDo"] }, canDoOnly: true, supportsDeliverables: true, supportsMilestones: true, supportsRubric: true, supportsInventory: true, supportsQuestionRubric: true },
  observation: { label: "Teacher Observation", itemGroups: ["structured", "unstructured", "observation"], supportsSections: true, supportsQuestionRubric: true },
  // Ungraded — the author's own questions, structured and/or open (the Structure setting picks
  // which the palette offers), in sections if they like. Never scored (see grading.utils.js), but
  // its questions can still be tagged to competency indicators like any other assessment type.
  // `groupLabels` / `kindLabels` word the palette for a survey.
  survey:      {
    label: "Survey", itemGroups: ["survey", "unstructured"], onlyKinds: { unstructured: SURVEY_OPEN_KINDS }, supportsSections: true,
    groupLabels: { survey: "Structured Questions", unstructured: "Open Questions" },
    kindLabels: {
      survey: "Rating Scale", mcqSingle: "Single Choice", mcqMultiple: "Multiple Choice (tick all that apply)", shortAnswer: "Short Text",
      canDo: "Can-do Check (I can…)", openEnded: "Open-ended Question", longAnswer: "Long Text", reflection: "Reflection",
    },
  },
};

// What a question type / palette group is called in this assessment type (a survey words some
// differently — "Single Choice" rather than "Multiple Choice (Single)").
export function kindLabel(type, kind) {
  return BUILDER_REGISTRY[type]?.kindLabels?.[kind] || ITEM_KIND_LABELS[kind] || kind;
}
export function groupLabel(type, group) {
  return BUILDER_REGISTRY[type]?.groupLabels?.[group] || ITEM_GROUP_LABELS[group] || group;
}

// Legacy items authored before the Builder existed used `questionType` with a smaller kind set.
// Normalize them so the Builder can still open/edit older assessments.
const LEGACY_KIND_MAP = {
  mcq: "mcqSingle", trueFalse: "trueFalse", matching: "matching", fillBlank: "fillBlank", ordering: "ordering",
  shortAnswer: "shortAnswer", essay: "essay", fileUpload: "documentUpload", mediaResponse: "videoUpload", linkSubmission: "externalLink",
};

export function normalizeLegacyItem(item) {
  if (item.kind) return item;
  const kind = LEGACY_KIND_MAP[item.questionType] || "shortAnswer";
  const { questionType, mediaType, ...rest } = item;
  return { kind, sectionId: null, ...rest };
}

// Marks are kept to one decimal place (30.123 → 30.1) — the server rounds the same way on save
// (assessment.utils.js's roundMarks). Rounding sums too keeps floating-point noise
// (3.3 + 3.3 + 3.4 = 9.999…) out of every total shown.
export function roundMarks(value) {
  return Math.round((Number(value) || 0) * 10) / 10;
}

// What a marks/points input holds after typing: a non-negative number to one decimal place.
export function marksInput(value) {
  return Math.max(0, roundMarks(value));
}

// Splits `total` into `count` shares of one decimal place that add up to exactly `total` — the
// last share takes the rounding difference (10 across 3 → 3.3, 3.3, 3.4).
export function splitMarks(total, count) {
  if (!count) return [];
  const share = Math.floor((roundMarks(total) / count) * 10) / 10;
  const shares = Array.from({ length: count }, () => share);
  shares[count - 1] = roundMarks(roundMarks(total) - share * (count - 1));
  return shares;
}

// A question/rubric-criterion's total is the sum of its per-indicator marks once any are
// tagged; otherwise it falls back to the plain `points` field (untagged entries). Mirrors
// server/src/modules/assessments/assessment.utils.js#computeEntryMarks.
export function entryMarks(entry) {
  if (entry?.indicatorMarks?.length) {
    return roundMarks(entry.indicatorMarks.reduce((sum, m) => sum + (Number(m.marks) || 0), 0));
  }
  return roundMarks(entry?.points);
}
