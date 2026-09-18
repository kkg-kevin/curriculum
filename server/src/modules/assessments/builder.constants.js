// Single extensible registry for the Assessment Template Builder.
// Adding a new item kind or assessment type later is one entry here — no other file needs restructuring.

const STRUCTURE_MODES = ["structured", "unstructured", "mixed"];

const STRUCTURED_ITEM_KINDS   = ["mcqSingle", "mcqMultiple", "trueFalse", "matching", "ordering", "fillBlank", "shortAnswer", "survey"];
const UNSTRUCTURED_ITEM_KINDS = ["longAnswer", "essay", "reflection", "scenarioResponse", "practicalTask", "openEnded"];
const SUBMISSION_ITEM_KINDS   = ["documentUpload", "imageUpload", "videoUpload", "audioUpload", "codeUpload", "externalLink"];
const OBSERVATION_ITEM_KINDS  = ["checklist", "rating", "note", "practicalSkill", "behaviour"];
// A survey assessment's own palette group — just the self-rating "survey" item kind (already
// usable as one structured-item kind among many inside a quiz/exam), scoped down to be the ONLY
// kind a survey's builder offers, since a survey is nothing but a flat list of rating questions.
const SURVEY_ITEM_KINDS = ["survey"];

const ITEM_KINDS = [...STRUCTURED_ITEM_KINDS, ...UNSTRUCTURED_ITEM_KINDS, ...SUBMISSION_ITEM_KINDS];

const TASK_TYPES = ["written", "practical", "research"];

// Which item-kind groups a builder's palette offers, and which extra content blocks it supports.
const BUILDER_REGISTRY = {
  quiz:        { itemGroups: ["structured", "unstructured", "submission"], supportsSections: true },
  exam:        { itemGroups: ["structured", "unstructured", "submission"], supportsSections: true },
  assignment:  { itemGroups: ["unstructured", "submission", "structured"], supportsSections: true, supportsTasks: true },
  project:     { itemGroups: ["unstructured", "submission"], supportsItems: false, supportsDeliverables: true, supportsMilestones: true, supportsInventory: true },
  observation: { itemGroups: ["structured", "unstructured", "observation"], supportsSections: true },
  // Ungraded self-reflection — a flat list of "rate your understanding" questions, no sections.
  // See grading.utils.js's requiresManualGrading/computeMaxScore for why it's never scored.
  survey:      { itemGroups: ["survey"], supportsSections: false },
};

module.exports = {
  STRUCTURE_MODES,
  STRUCTURED_ITEM_KINDS,
  UNSTRUCTURED_ITEM_KINDS,
  SUBMISSION_ITEM_KINDS,
  OBSERVATION_ITEM_KINDS,
  SURVEY_ITEM_KINDS,
  ITEM_KINDS,
  TASK_TYPES,
  BUILDER_REGISTRY,
};
