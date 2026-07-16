// Assessment schema & Builder registry. Mirrors server/src/modules/assessments/builder.constants.js
// and assessment.validation.js — single source of truth for the Assessment Builder UI.

export const ASSESSMENT_TYPES = ["quiz", "exam", "project", "assignment", "observation"];

export const STRUCTURE_MODES = ["structured", "unstructured", "mixed"];
export const STRUCTURE_MODE_LABELS = { structured: "Structured", unstructured: "Unstructured", mixed: "Mixed" };

export const STRUCTURED_ITEM_KINDS   = ["mcqSingle", "mcqMultiple", "trueFalse", "matching", "ordering", "fillBlank", "shortAnswer"];
export const UNSTRUCTURED_ITEM_KINDS = ["longAnswer", "essay", "reflection", "scenarioResponse", "practicalTask", "openEnded"];
export const SUBMISSION_ITEM_KINDS   = ["documentUpload", "imageUpload", "videoUpload", "audioUpload", "codeUpload", "externalLink"];
export const OBSERVATION_ITEM_KINDS  = ["checklist", "rating", "note", "practicalSkill", "behaviour"];

export const TASK_TYPES = ["written", "practical", "research"];
export const TASK_TYPE_LABELS = { written: "Written", practical: "Practical", research: "Research" };

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

// Reuses the app's existing palette — no new colors introduced.
export const ITEM_GROUP_COLORS = { structured: "#25476a", unstructured: "#38aae1", submission: "#059669", observation: "#D97706" };
export const ITEM_GROUP_LABELS = { structured: "Structured Items", unstructured: "Unstructured Items", submission: "Submission Items", observation: "Observation Items" };

export const ITEM_GROUPS = {
  structured: STRUCTURED_ITEM_KINDS,
  unstructured: UNSTRUCTURED_ITEM_KINDS,
  submission: SUBMISSION_ITEM_KINDS,
  observation: OBSERVATION_ITEM_KINDS,
};

// Which item-kind groups each assessment type's palette offers, and which extra content blocks it supports.
export const BUILDER_REGISTRY = {
  quiz:        { label: "Quiz", itemGroups: ["structured", "unstructured", "submission"], supportsSections: true },
  exam:        { label: "Exam", itemGroups: ["structured", "unstructured", "submission"], supportsSections: true },
  assignment:  { label: "Assignment", itemGroups: ["unstructured", "submission", "structured"], supportsSections: true, supportsTasks: true },
  project:     { label: "Project", itemGroups: ["unstructured", "submission"], supportsItems: false, supportsDeliverables: true, supportsMilestones: true, supportsRubric: true, supportsInventory: true },
  observation: { label: "Teacher Observation", itemGroups: ["observation"], supportsSections: true },
};

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

// A question/rubric-criterion's total is the sum of its per-indicator marks once any are
// tagged; otherwise it falls back to the plain `points` field (untagged entries). Mirrors
// server/src/modules/assessments/assessment.utils.js#computeEntryMarks.
export function entryMarks(entry) {
  if (entry?.indicatorMarks?.length) {
    return entry.indicatorMarks.reduce((sum, m) => sum + (Number(m.marks) || 0), 0);
  }
  return Number(entry?.points) || 0;
}
