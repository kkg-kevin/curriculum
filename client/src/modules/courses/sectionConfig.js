export const SECTIONS = [
  { key: "outcomes",     label: "Learning Outcomes" },
  { key: "introduction", label: "Introduction" },
  { key: "mainConcepts", label: "Main Concepts" },
  { key: "activities",   label: "Activities" },
  { key: "notes",        label: "Teacher's Guide" },
  { key: "resources",    label: "Resources" },
];

export const SECTION_LABELS = Object.fromEntries(SECTIONS.map((s) => [s.key, s.label]));

// Untitled sessions default their title to "" — avoid showing "Session 1: " with nothing after it,
// and avoid the double-naming that happens if a session's title itself echoes "Session 1".
export function sessionLabel(session, index) {
  return session.title ? `Session ${index + 1}: ${session.title}` : `Session ${index + 1}`;
}

// Main Concepts, Activities, and Teacher's Guide are repeatable lists, not single fields — each
// holds its own singular label (used both as the fallback item name and in "+ Add X" buttons).
export const REPEATABLE_SECTIONS = {
  mainConcepts: { singular: "Main Concept" },
  activities:   { singular: "Activity" },
  notes:        { singular: "Note" },
};

export function isRepeatableSection(sectionKey) {
  return Object.prototype.hasOwnProperty.call(REPEATABLE_SECTIONS, sectionKey);
}

// A plain link into a repeatable section should land on its first item rather than a bare,
// item-less section page.
export function sectionLinkPath(courseId, session, section) {
  const base = `/courses/${courseId}/sessions/${session.id}/sections/${section.key}`;
  if (isRepeatableSection(section.key)) {
    const firstId = session[section.key]?.[0]?.id;
    return firstId ? `${base}/${firstId}` : base;
  }
  return base;
}

export function repeatableItemLabel(sectionKey, item, index) {
  const singular = REPEATABLE_SECTIONS[sectionKey]?.singular || "Item";
  return item.title ? item.title : `${singular} ${index + 1}`;
}
