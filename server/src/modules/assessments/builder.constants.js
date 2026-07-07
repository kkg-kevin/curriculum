// Single extensible registry for the Assessment Template Builder.
// Adding a new item kind or assessment type later is one entry here — no other file needs restructuring.

const STRUCTURE_MODES = ["structured", "unstructured", "mixed"];

const STRUCTURED_ITEM_KINDS   = ["mcqSingle", "mcqMultiple", "trueFalse", "matching", "ordering", "fillBlank", "shortAnswer"];
const UNSTRUCTURED_ITEM_KINDS = ["longAnswer", "essay", "reflection", "scenarioResponse", "practicalTask", "openEnded"];
const SUBMISSION_ITEM_KINDS   = ["documentUpload", "imageUpload", "videoUpload", "audioUpload", "codeUpload", "externalLink"];
const OBSERVATION_ITEM_KINDS  = ["checklist", "rating", "note", "practicalSkill", "behaviour"];

const ITEM_KINDS = [...STRUCTURED_ITEM_KINDS, ...UNSTRUCTURED_ITEM_KINDS, ...SUBMISSION_ITEM_KINDS];

const TASK_TYPES = ["written", "practical", "research"];

// Which item-kind groups a builder's palette offers, and which extra content blocks it supports.
const BUILDER_REGISTRY = {
  quiz:        { itemGroups: ["structured", "unstructured", "submission"], supportsSections: true },
  exam:        { itemGroups: ["structured", "unstructured", "submission"], supportsSections: true },
  assignment:  { itemGroups: ["unstructured", "submission", "structured"], supportsSections: true, supportsTasks: true },
  project:     { itemGroups: ["unstructured", "submission"], supportsSections: true, supportsDeliverables: true, supportsMilestones: true, supportsInventory: true },
  observation: { itemGroups: ["observation"], supportsSections: true, supportsRubric: true },
};

module.exports = {
  STRUCTURE_MODES,
  STRUCTURED_ITEM_KINDS,
  UNSTRUCTURED_ITEM_KINDS,
  SUBMISSION_ITEM_KINDS,
  OBSERVATION_ITEM_KINDS,
  ITEM_KINDS,
  TASK_TYPES,
  BUILDER_REGISTRY,
};
