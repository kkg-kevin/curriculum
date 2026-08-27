// Derived from minAge/maxAge rather than a stored `ageRange` string — the Developmental Stage
// create/edit form (CompetenciesPage.jsx's AgeCategoriesPanel) never collects a separate free-text
// range, so a stored `ageRange` column would always be empty for any stage authored through the
// app. Computing it here means there's exactly one source of truth (the numeric bounds actually
// set and validated) instead of a second field that can silently drift out of sync with them.
export function formatAgeRange(minAge, maxAge) {
  if (minAge == null && maxAge == null) return "";
  if (minAge != null && maxAge != null) return `${minAge}-${maxAge} yrs`;
  if (minAge != null) return `${minAge}+ yrs`;
  return `Up to ${maxAge} yrs`;
}
