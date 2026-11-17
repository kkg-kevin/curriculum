import { Suspense, lazy } from "react";
import { readSession, writeSession } from "../utils/safeStorage";

// Pages load when they're first opened, not all up front (17 Nov 2026) — the portal used to ship
// every screen in one 5 MB file. lazyPage(() => import("…Page")) returns a component used exactly
// like the page itself (props pass through), showing a small "Loading…" while its file arrives.
//
// A release deletes the previous build's files, so a tab opened before it can ask for a page
// file that no longer exists. Then the page reloads once to pick up the new build; a second
// failure within a minute is shown as an error instead of reloading again.

const RELOADED_AT = "digifunzi:page-reload-at";

function load(importer, name) {
  return importer()
    .then((module) => ({ default: name ? module[name] : module.default }))
    .catch((err) => {
      const last = Number(readSession(RELOADED_AT) || 0);
      if (Date.now() - last > 60 * 1000) {
        writeSession(RELOADED_AT, String(Date.now()));
        window.location.reload();
        return new Promise(() => {});
      }
      throw err;
    });
}

function PageLoading() {
  return (
    <div role="status" aria-live="polite" style={{ minHeight: 240, display: "grid", placeItems: "center", color: "#9CA3AF", fontSize: 14, fontFamily: "Inter, sans-serif" }}>
      Loading…
    </div>
  );
}

export function lazyPage(importer, name) {
  const Lazy = lazy(() => load(importer, name));
  function Page(props) {
    return (
      <Suspense fallback={<PageLoading />}>
        <Lazy {...props} />
      </Suspense>
    );
  }
  return Page;
}
