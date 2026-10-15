import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";

// Unsaved work on a long form (an assessment, a course, a session's content) kept in this
// browser as it is typed, so a closed tab, a power cut, a crash or being signed out for
// inactivity doesn't lose it. The next time the same form is opened, the page offers the draft
// back (DraftRestoreBanner) — Restore or Discard. A draft is cleared once the form is saved.
//
// Per signed-in account (two people sharing a computer never see each other's drafts) and per
// form + record ("assessment:edit:<id>", "assessment:new:quiz"…). This device only: a draft
// started on one computer is not offered on another. Drafts older than MAX_AGE_DAYS are dropped.

const PREFIX = "draft:";
const MAX_AGE_DAYS = 30;
const WRITE_DELAY_MS = 600;

const storageKey = (userId, key) => `${PREFIX}${userId || "anon"}:${key}`;

function safe(fn, fallback = null) {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

// JSON with object keys in a fixed order — a form library can hand back the same contents with
// its fields in a different order than they were loaded in.
function stableJson(value) {
  return JSON.stringify(value, (_, v) =>
    v && typeof v === "object" && !Array.isArray(v) ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, v[k]])) : v,
  );
}

// True when a form's contents match what was loaded — no unsaved work, so no draft to keep.
export function isSameContent(a, b) {
  return stableJson(a ?? null) === stableJson(b ?? null);
}

export function readDraft(userId, key) {
  const raw = safe(() => window.localStorage.getItem(storageKey(userId, key)));
  const parsed = raw ? safe(() => JSON.parse(raw)) : null;
  return parsed && parsed.savedAt && "value" in parsed ? parsed : null;
}

// For a save that finishes after the form has moved on to another record (the session editor's
// Prev/Next): removes that record's draft by key, outside the hook.
export function removeDraft(userId, key) {
  safe(() => window.localStorage.removeItem(storageKey(userId, key)));
}

let purged = false;
function purgeOldDrafts() {
  if (purged) return;
  purged = true;
  const cutoff = Date.now() - MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
  safe(() => {
    for (let i = window.localStorage.length - 1; i >= 0; i -= 1) {
      const k = window.localStorage.key(i);
      if (!k?.startsWith(PREFIX)) continue;
      const savedAt = safe(() => JSON.parse(window.localStorage.getItem(k))?.savedAt);
      if (!savedAt || Date.parse(savedAt) < cutoff) window.localStorage.removeItem(k);
    }
  });
}

/**
 * key       — which form and record; null while the form isn't ready (nothing is read or kept)
 * value     — the form's current contents (plain data)
 * dirty     — true while the form differs from what's saved; only then is a draft kept
 * baseUpdatedAt — the record's updatedAt when editing, so a restore can say if it was saved
 *             again since the draft was written
 * saved     — the form's contents as loaded; a draft that matches them (it was saved after all)
 *             is dropped instead of offered
 *
 * Returns
 * found     — a draft from before, waiting for Restore/Discard ({ value, savedAt, baseUpdatedAt }),
 *             or null. While one is waiting nothing new is written, so the blank or freshly
 *             loaded form can't overwrite it.
 * restore() — hands back found.value and keeps it as the current draft
 * discard() — deletes the waiting draft
 * clear()   — call when the form has been saved
 * savedAt   — when the current draft was last written (for a "Draft kept on this device" note)
 */
export function useDraft(key, { value, dirty, baseUpdatedAt = null, saved }) {
  const { user } = useAuth();
  const userId = user?.id;
  const [found, setFound] = useState(null);
  const [savedAt, setSavedAt] = useState(null);
  // The key the form's contents belong to. When the key changes (the session editor's Next), the
  // render that brings the new key still carries the previous record's contents; nothing is
  // written until the next render, once the page has loaded the new record's.
  const [activeKey, setActiveKey] = useState(null);
  const timer = useRef(null);
  const pending = useRef(null);
  // After clear() the form is still dirty until the page navigates away; nothing may be written
  // again until the contents actually change.
  const clearedAt = useRef(null);
  const savedRef = useRef(saved);
  savedRef.current = saved;

  useEffect(() => {
    purgeOldDrafts();
    clearedAt.current = null;
    setSavedAt(null);
    const draft = key ? readDraft(userId, key) : null;
    if (draft && savedRef.current !== undefined && isSameContent(draft.value, savedRef.current)) {
      removeDraft(userId, key);
      setFound(null);
    } else {
      setFound(draft);
    }
    setActiveKey(key);
  }, [userId, key]);

  const write = useCallback(
    (entry) => {
      const ok = safe(() => {
        window.localStorage.setItem(storageKey(userId, key), JSON.stringify(entry));
        return true;
      }, false);
      if (ok) setSavedAt(entry.savedAt);
    },
    [userId, key],
  );

  const flush = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (pending.current) write(pending.current);
    pending.current = null;
  }, [write]);

  const serialized = key && dirty ? safe(() => JSON.stringify(value)) : null;

  useEffect(() => {
    if (!key || key !== activeKey || found || !serialized) return;
    if (clearedAt.current !== null) {
      if (clearedAt.current === serialized) return;
      clearedAt.current = null;
    }
    pending.current = { value: JSON.parse(serialized), savedAt: new Date().toISOString(), baseUpdatedAt };
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, WRITE_DELAY_MS);
  }, [key, activeKey, found, serialized, baseUpdatedAt, flush]);

  // A tab being closed, the browser quitting or the page being swapped out — write now rather
  // than lose the last half-second of typing. Also on leaving the form inside the portal.
  useEffect(() => {
    const onHide = () => flush();
    const onVisibility = () => document.visibilityState === "hidden" && flush();
    window.addEventListener("pagehide", onHide);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", onHide);
      document.removeEventListener("visibilitychange", onVisibility);
      flush();
    };
  }, [flush]);

  // The browser's own "Leave site?" question while there's unsaved work — the draft would come
  // back anyway, but most people closing the tab mid-form did it by mistake.
  useEffect(() => {
    if (!dirty || clearedAt.current !== null) return undefined;
    const warn = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, savedAt]);

  const restore = useCallback(() => {
    const draft = found;
    setFound(null);
    return draft?.value ?? null;
  }, [found]);

  const discard = useCallback(() => {
    removeDraft(userId, key);
    setFound(null);
  }, [userId, key]);

  const clear = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    pending.current = null;
    clearedAt.current = serialized;
    removeDraft(userId, key);
    setSavedAt(null);
  }, [userId, key, serialized]);

  return { found, restore, discard, clear, savedAt };
}
