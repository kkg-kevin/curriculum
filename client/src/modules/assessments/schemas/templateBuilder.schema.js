// Assessment Template Builder — schema & registry. Mirrors server/src/modules/templates/builder.constants.js
// and template.validation.js. This is deliberately decoupled from assessment.schema.js (the live
// Assessment editing surface) — templates are a richer, standalone authoring layer; "applying" one
// into a real assessment only ever copies the fields the live schema already understands.

export const STRUCTURE_MODES = ["structured", "unstructured", "mixed"];
export const STRUCTURE_MODE_LABELS = { structured: "Structured", unstructured: "Unstructured", mixed: "Mixed" };

export const STRUCTURED_ITEM_KINDS   = ["mcqSingle", "mcqMultiple", "trueFalse", "matching", "ordering", "fillBlank", "shortAnswer"];
export const UNSTRUCTURED_ITEM_KINDS = ["longAnswer", "essay", "reflection", "scenarioResponse", "practicalTask", "openEnded"];
export const SUBMISSION_ITEM_KINDS   = ["documentUpload", "imageUpload", "videoUpload", "audioUpload", "codeUpload", "externalLink"];
export const OBSERVATION_ITEM_KINDS  = ["checklist", "rating", "note", "practicalSkill", "behaviour"];

export const TASK_TYPES = ["written", "practical", "research"];
export const TASK_TYPE_LABELS = { written: "Written", practical: "Practical", research: "Research" };

export const PROGRESS_ARC_LEVELS = ["exposure", "practice", "application", "mastery", "specialization"];
export const PROGRESS_ARC_LEVEL_LABELS = {
  exposure: "Exposure", practice: "Practice", application: "Application", mastery: "Mastery", specialization: "Specialization",
};

export const ITEM_KIND_LABELS = {
  mcqSingle: "Multiple Choice (Single)", mcqMultiple: "Multiple Choice (Multiple)", trueFalse: "True / False",
  matching: "Matching", ordering: "Ordering", fillBlank: "Fill in the Blank", shortAnswer: "Short Answer",
  longAnswer: "Long Answer", essay: "Essay", reflection: "Reflection", scenarioResponse: "Scenario Based",
  practicalTask: "Practical Task", openEnded: "Open-ended Question",
  documentUpload: "Document Upload", imageUpload: "Image Upload", videoUpload: "Video Upload",
  audioUpload: "Audio Upload", codeUpload: "Code Upload", externalLink: "External Link",
  checklist: "Checklist Item", rating: "Rating Item", note: "Observation Note",
  practicalSkill: "Practical Skill Observation", behaviour: "Behaviour Observation",
};

// Reuses the app's existing palette (SettingsPage TEMPLATE_TYPE_COLORS) — no new colors introduced.
export const ITEM_GROUP_COLORS = { structured: "#25476a", unstructured: "#38aae1", submission: "#059669", observation: "#D97706" };
export const ITEM_GROUP_LABELS = { structured: "Structured Items", unstructured: "Unstructured Items", submission: "Submission Items", observation: "Observation Items" };

export const ITEM_GROUPS = {
  structured: STRUCTURED_ITEM_KINDS,
  unstructured: UNSTRUCTURED_ITEM_KINDS,
  submission: SUBMISSION_ITEM_KINDS,
  observation: OBSERVATION_ITEM_KINDS,
};

// Which item-kind groups each builder's palette offers, and which extra content blocks it supports.
export const BUILDER_REGISTRY = {
  quiz:        { label: "Quiz", itemGroups: ["structured", "unstructured", "submission"], supportsSections: true },
  exam:        { label: "Exam", itemGroups: ["structured", "unstructured", "submission"], supportsSections: true },
  assignment:  { label: "Assignment", itemGroups: ["unstructured", "submission", "structured"], supportsSections: true, supportsTasks: true },
  project:     { label: "Project", itemGroups: ["unstructured", "submission"], supportsSections: true, supportsDeliverables: true, supportsMilestones: true },
  observation: { label: "Teacher Observation", itemGroups: ["observation"], supportsSections: true },
};

// Legacy items authored before this builder existed used `questionType` with a smaller kind set.
// Normalize them so the builder can still open/edit older templates.
const LEGACY_KIND_MAP = {
  mcq: "mcqSingle", trueFalse: "trueFalse", matching: "matching", fillBlank: "fillBlank", ordering: "ordering",
  shortAnswer: "shortAnswer", essay: "essay", fileUpload: "documentUpload", mediaResponse: "videoUpload", linkSubmission: "externalLink",
};

export function normalizeLegacyItem(item) {
  if (item.kind) return item;
  const kind = LEGACY_KIND_MAP[item.questionType] || "shortAnswer";
  const { questionType, mediaType, ...rest } = item;
  return { kind, mapping: {}, sectionId: null, ...rest };
}

export function emptyMapping() {
  return { competencyId: "", progressArcLevel: null, learningOutcome: "", performanceIndicator: "" };
}

export function hasMapping(mapping) {
  if (!mapping) return false;
  return !!(mapping.competencyId || mapping.progressArcLevel || mapping.learningOutcome?.trim() || mapping.performanceIndicator?.trim());
}
