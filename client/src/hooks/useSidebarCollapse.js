import { useCallback, useSyncExternalStore } from "react";

// Desktop-only sidebar collapse (icon rail vs full width) — mobile already has its own
// open/close drawer via isMobileOpen, unrelated to this. Persisted per-browser so it stays
// collapsed across reloads; keyed by portal so an admin and a learner sharing a machine (or one
// person switching portals) don't force the same choice onto every sidebar.
//
// Backed by a small module-level store rather than plain useState: the sidebar (which toggles)
// and its layout (which sizes the content area off the same value) are separate components, so
// per-instance state would let one update without the other — the collapsed sidebar would
// reclaim space the content area didn't grow into until a reload re-read localStorage. A shared
// store keeps every subscriber in lockstep, and also syncs across browser tabs via `storage`.
const STORAGE_PREFIX = "digifunzi:sidebarCollapsed:";

export const SIDEBAR_WIDTH = 260;
export const SIDEBAR_COLLAPSED_WIDTH = 72;

function storageKey(portalKey) {
  return `${STORAGE_PREFIX}${portalKey}`;
}

function readStored(portalKey) {
  try {
    return localStorage.getItem(storageKey(portalKey)) === "1";
  } catch {
    return false;
  }
}

// One store per portal key, created lazily. Each holds the current boolean plus a Set of
// subscriber callbacks (the useSyncExternalStore listeners for every mounted consumer).
const stores = new Map();

function getStore(portalKey) {
  let store = stores.get(portalKey);
  if (!store) {
    store = { value: readStored(portalKey), listeners: new Set() };

    // Cross-tab: another tab toggling the same portal's sidebar writes localStorage; mirror it.
    if (typeof window !== "undefined") {
      window.addEventListener("storage", (e) => {
        if (e.key !== storageKey(portalKey)) return;
        const next = e.newValue === "1";
        if (next !== store.value) {
          store.value = next;
          store.listeners.forEach((fn) => fn());
        }
      });
    }

    stores.set(portalKey, store);
  }
  return store;
}

function setCollapsedValue(portalKey, next) {
  const store = getStore(portalKey);
  const value = typeof next === "function" ? next(store.value) : next;
  if (value === store.value) return;
  store.value = value;
  try {
    localStorage.setItem(storageKey(portalKey), value ? "1" : "0");
  } catch {
    // Private browsing / storage disabled — collapse still works for the session, just doesn't persist.
  }
  store.listeners.forEach((fn) => fn());
}

export function useSidebarCollapse(portalKey) {
  const store = getStore(portalKey);

  const subscribe = useCallback(
    (listener) => {
      store.listeners.add(listener);
      return () => store.listeners.delete(listener);
    },
    [store]
  );

  const collapsed = useSyncExternalStore(
    subscribe,
    () => store.value,
    () => false // SSR / no-window fallback
  );

  const setCollapsed = useCallback((next) => setCollapsedValue(portalKey, next), [portalKey]);

  return [collapsed, setCollapsed];
}
