// Single extensible registry for the Assessment Template Builder.
// Adding a new item kind or assessment type later is one entry here — no other file needs restructuring.

const STRUCTURE_MODES = ["structured", "unstructured", "mixed"];

const STRUCTURED_ITEM_KINDS   = ["mcqSingle", "mcqMultiple", "trueFalse", "matching", "ordering", "fillBlank", "shortAnswer", "survey", "canDo"];
const UNSTRUCTURED_ITEM_KINDS = ["longAnswer", "essay", "reflection", "scenarioResponse", "practicalTask", "openEnded"];
const SUBMISSION_ITEM_KINDS   = ["documentUpload", "imageUpload", "videoUpload", "audioUpload", "codeUpload", "externalLink"];
const OBSERVATION_ITEM_KINDS  = ["checklist", "rating", "note", "practicalSkill", "behaviour"];
// A survey assessment's own palette group — just the self-rating "survey" item kind (already
// usable as one structured-item kind among many inside a quiz/exam), scoped down to be the ONLY
// kind a survey's builder offers, since a survey is nothing but a flat list of rating questions.
const SURVEY_ITEM_KINDS = ["survey"];
// "canDo" (a structured item): the learner reads a statement ("I can write a loop that repeats
// 5 times") and says how well they can do it. Unlike a Survey (Scale) question it is marked —
// automatically, from the level picked (see grading.utils.js). Offered in every assessment type.
// The levels, in order, with the share of the question's marks each earns. The shares are fixed;
// the wording can be changed per question (an item's `levelLabels`, same order). A learner's
// answer is stored as the level's key, so changing the wording never breaks answers given.
const CAN_DO_LEVELS = [
  { key: "independent", credit: 1, label: "I can do it independently" },
  { key: "withHelp", credit: 0.5, label: "I can do it with help" },
  { key: "cannot", credit: 0, label: "I can't do it" },
];

const ITEM_KINDS = [...STRUCTURED_ITEM_KINDS, ...UNSTRUCTURED_ITEM_KINDS, ...SUBMISSION_ITEM_KINDS];

const TASK_TYPES = ["written", "practical", "research"];

// Which item-kind groups a builder's palette offers, and which extra content blocks it supports.
// Every type offers can-do checks (structured items). A project's and a survey's Structured Items
// are just the can-do check (`onlyKinds`) — a project's work is otherwise its deliverables,
// milestones and rubric.
const BUILDER_REGISTRY = {
  quiz:        { itemGroups: ["structured", "unstructured", "submission"], supportsSections: true },
  exam:        { itemGroups: ["structured", "unstructured", "submission"], supportsSections: true },
  assignment:  { itemGroups: ["unstructured", "submission", "structured"], supportsSections: true, supportsTasks: true },
  project:     { itemGroups: ["structured"], onlyKinds: { structured: ["canDo"] }, supportsDeliverables: true, supportsMilestones: true, supportsInventory: true },
  observation: { itemGroups: ["structured", "unstructured", "observation"], supportsSections: true },
  // Ungraded self-reflection — a flat list of "rate your understanding" questions, no sections.
  // See grading.utils.js's requiresManualGrading/computeMaxScore for why it's never scored; a
  // can-do check in a survey shows its levels but carries no marks either.
  survey:      { itemGroups: ["survey", "structured"], onlyKinds: { structured: ["canDo"] }, supportsSections: false },
};

module.exports = {
  STRUCTURE_MODES,
  STRUCTURED_ITEM_KINDS,
  UNSTRUCTURED_ITEM_KINDS,
  SUBMISSION_ITEM_KINDS,
  OBSERVATION_ITEM_KINDS,
  SURVEY_ITEM_KINDS,
  CAN_DO_LEVELS,
  ITEM_KINDS,
  TASK_TYPES,
  BUILDER_REGISTRY,
};
