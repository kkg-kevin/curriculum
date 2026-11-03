import { readLocal, writeLocal } from "../../../utils/safeStorage";

const STORAGE_KEY = "schoolPortal.activeHubId";

// Single source of truth for which hub (a school account's own hub, or one of its branch hubs)
// the portal is currently scoped to — read by the axios interceptor (api.js) on every request
// and written by useSchoolPortalScope.js when the admin switches hub, so the two never drift
// apart. Mirrors learner-portal/utils/activeLearner.js exactly.
export function getActiveHubId() {
  return readLocal(STORAGE_KEY);
}

export function setActiveHubId(id) {
  writeLocal(STORAGE_KEY, id);
}
