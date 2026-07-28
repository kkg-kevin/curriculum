const STORAGE_KEY = "learnerPortal.activeLearnerId";

// Single source of truth for which of a guardian's linked learners the portal is currently
// scoped to — read by the axios interceptor (api.js) on every request and written by
// useLearnerPortalScope.js when the guardian switches child, so the two never drift apart.
export function getActiveLearnerId() {
  return typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
}

export function setActiveLearnerId(id) {
  if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, id);
}
