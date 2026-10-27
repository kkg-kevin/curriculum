// Single extensible registry for the Assessment Template Builder.
// Adding a new item kind or assessment type later is one entry here — no other file needs restructuring.

const STRUCTURE_MODES = ["structured", "unstructured", "mixed"];

const STRUCTURED_ITEM_KINDS   = ["mcqSingle", "mcqMultiple", "trueFalse", "matching", "ordering", "fillBlank", "shortAnswer", "survey", "canDo"];
const UNSTRUCTURED_ITEM_KINDS = ["longAnswer", "essay", "reflection", "scenarioResponse", "practicalTask", "openEnded"];
const SUBMISSION_ITEM_KINDS   = ["documentUpload", "imageUpload", "videoUpload", "audioUpload", "codeUpload", "externalLink"];
const OBSERVATION_ITEM_KINDS  = ["checklist", "rating", "note", "practicalSkill", "behaviour"];
// A survey's own questions (27 Oct 2026: surveys are built freely, like a form). Structured — a
// rating scale (its points worded per question), single choice, multiple choice (tick all that
// apply), short text, and the can-do check; open (unstructured) — open-ended, long text and
// reflection. Nothing in a survey is marked, so a choice question has no correct answer.
const SURVEY_ITEM_KINDS = ["survey", "mcqSingle", "mcqMultiple", "shortAnswer", "canDo"];
const SURVEY_OPEN_KINDS = ["openEnded", "longAnswer", "reflection"];
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
  // Ungraded — the author's own questions, structured and/or open, in sections if they like.
  // See grading.utils.js's requiresManualGrading/computeMaxScore for why it's never scored.
  survey:      { itemGroups: ["survey", "unstructured"], onlyKinds: { unstructured: SURVEY_OPEN_KINDS }, supportsSections: true },
};

module.exports = {
  STRUCTURE_MODES,
  STRUCTURED_ITEM_KINDS,
  UNSTRUCTURED_ITEM_KINDS,
  SUBMISSION_ITEM_KINDS,
  OBSERVATION_ITEM_KINDS,
  SURVEY_ITEM_KINDS,
  SURVEY_OPEN_KINDS,
  CAN_DO_LEVELS,
  ITEM_KINDS,
  TASK_TYPES,
  BUILDER_REGISTRY,
};
