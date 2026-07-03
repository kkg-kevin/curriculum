export const SECTIONS = [
  { key: "outcomes",     label: "Learning Outcomes" },
  { key: "introduction", label: "Introduction" },
  { key: "mainConcepts", label: "Main Concepts" },
  { key: "activities",   label: "Activities" },
  { key: "notes",        label: "Teacher's Note" },
  { key: "resources",    label: "Resources" },
];

export const SECTION_LABELS = Object.fromEntries(SECTIONS.map((s) => [s.key, s.label]));

// Untitled sessions default their title to "" — avoid showing "Session 1: " with nothing after it,
// and avoid the double-naming that happens if a session's title itself echoes "Session 1".
export function sessionLabel(session, index) {
  return session.title ? `Session ${index + 1}: ${session.title}` : `Session ${index + 1}`;
}
