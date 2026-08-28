import { useEffect, useState } from "react";

// Desktop-only sidebar collapse (icon rail vs full width) — mobile already has its own
// open/close drawer via isMobileOpen, unrelated to this. Persisted per-browser so it stays
// collapsed across reloads; keyed by portal so an admin and a learner sharing a machine (or one
// person switching portals) don't force the same choice onto every sidebar.
const STORAGE_PREFIX = "digifunzi:sidebarCollapsed:";

export const SIDEBAR_WIDTH = 260;
export const SIDEBAR_COLLAPSED_WIDTH = 72;

export function useSidebarCollapse(portalKey) {
  const storageKey = `${STORAGE_PREFIX}${portalKey}`;
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(storageKey) === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, collapsed ? "1" : "0");
    } catch {
      // Private browsing / storage disabled — collapse still works for the session, just doesn't persist.
    }
  }, [storageKey, collapsed]);

  return [collapsed, setCollapsed];
}
