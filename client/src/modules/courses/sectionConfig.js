export const SECTIONS = [
  { key: "outcomes",     label: "Learning Outcomes" },
  { key: "introduction", label: "Introduction" },
  { key: "mainConcepts", label: "Main Concepts" },
  { key: "activities",   label: "Activities" },
  { key: "notes",        label: "Notes" },
  { key: "resources",    label: "Resources" },
];

export const SECTION_LABELS = Object.fromEntries(SECTIONS.map((s) => [s.key, s.label]));
