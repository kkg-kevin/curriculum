import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";

// A long form's unsaved work (the assessment builder, Add/Edit Course, the session editor),
// written to the workspace as it is typed (server: modules/drafts/) so nothing is lost if the page
// closes, the connection drops or the session times out before Save. A draft is in the workspace,
// not this browser: several people often share one account, and each new record being built gets
// a draft of its own, shown for anyone to carry on (DraftCard on the list pages). Deleted once saved.
//
// Writes wait for a pause in typing and are spaced out (a shared account shares one request
// allowance), and go out at once when the page is hidden, closed or left. Each write names the
// revision it builds on; if someone else wrote the same draft in between (or deleted it), this
// person's work is kept as a new draft instead of overwriting theirs.

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";
const QUIET_MS = 2500; // write once typing pauses this long…
const MIN_GAP_MS = 10000; // …but no more often than this…
const MAX_WAIT_MS = 30000; // …and never hold changes back longer than this
const RETRY_MS = 15000;
// Browsers send a request on after the page has closed (keepalive) only up to 64 KB.
const KEEPALIVE_LIMIT = 60000;
// Refusals that sending the same thing again won't change.
const FINAL_STATUSES = [400, 403, 413];

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

// fetch rather than the shared axios instance: only fetch can finish a request after the tab
// has closed. The session cookie goes with it the same way.
async function request(method, url, body, keepalive) {
  const res = await fetch(url, {
    method,
    credentials: "include",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body,
    keepalive,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.message || `Request failed (${res.status})`);
    err.statusCode = res.status;
    err.code = data.code;
    throw err;
  }
  return data.data;
}

// One draft being written: the form's work on one record. The session editor moves from record to
// record (release()), so the hook can be on its second or third of these.
const newScope = (draft = null) => ({ draft, inFlight: null, keepalive: true, discard: false });

/**
 * endpoint     — the drafts API, e.g. "/api/courses/drafts"
 * kind         — "assessment" | "course" | "course-session"
 * value        — the form's contents (plain data), or null while it loads
 * dirty        — the form differs from how it was opened; a draft is only started once it does
 * recordId     — the record being edited; null for a new one
 * type         — a new assessment's type
 * onCreated(id) — a draft was started; the page puts its id in the address so a reload carries on
 *
 * Returns
 * status    — { state: "idle" | "saving" | "saved" | "error" | "failed", savedAt }
 * adopt({ id, revision, content }) — carry on a draft that was loaded: writes go to it from now on
 * release() — the record is being saved and the form moves on: stops writing to this draft (after
 *             sending what's left) and returns discard(), to call once the save has gone through
 * clear()   — the record was saved and the page is done: stop writing and delete the draft
 * currentDraftId() — the draft being written now, if there is one (so a page never offers it back)
 */
export function useWorkspaceDraft({ endpoint, kind, value, dirty, recordId = null, type = null, onCreated }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState({ state: "idle", savedAt: null });

  const scope = useRef(null);
  if (!scope.current) scope.current = newScope();
  const lastSent = useRef(null); // the form as last written (or as loaded from a draft), as JSON
  const pending = useRef(null); // { json, since } — changes not written yet
  const timer = useRef(null);
  const lastWriteAt = useRef(0);
  const closed = useRef(false); // saved and done — nothing more may be written
  const mounted = useRef(true);
  const props = useRef({});
  props.current = { endpoint, kind, recordId, type, onCreated };

  // Built once: everything below works through the refs above, so it never goes stale.
  const engine = useRef(null);
  if (!engine.current) {
    const url = (path = "") => `${API_URL}${props.current.endpoint}${path}`;
    const refreshLists = () => queryClient.invalidateQueries({ queryKey: ["drafts"] });

    const deleteDraft = (s) => {
      const current = s.draft;
      s.draft = null;
      if (current) request("DELETE", url(`/${current.id}`), undefined, true).catch(() => {}).finally(refreshLists);
    };

    const write = async (s, json) => {
      if (s.draft) {
        const body = `{"revision":${s.draft.revision},"content":${json}}`;
        s.keepalive = body.length < KEEPALIVE_LIMIT;
        try {
          const saved = await request("PUT", url(`/${s.draft.id}`), body, s.keepalive);
          s.draft = { id: saved.id, revision: saved.revision };
          return;
        } catch (err) {
          if (err.statusCode !== 409 && err.statusCode !== 404) throw err;
          s.draft = null;
          if (mounted.current) {
            toast(
              err.statusCode === 409
                ? "Someone else changed this draft at the same time — your work is kept as a separate draft."
                : "This draft was deleted elsewhere — your work is kept as a new draft.",
              { duration: 6000 },
            );
          }
        }
      }
      const { kind: forKind, recordId: forRecord, type: forType } = props.current;
      const body = `{"kind":${JSON.stringify(forKind)},"recordId":${JSON.stringify(forRecord || null)},"type":${JSON.stringify(forType || null)},"content":${json}}`;
      s.keepalive = body.length < KEEPALIVE_LIMIT;
      const created = await request("POST", url(), body, s.keepalive);
      s.draft = { id: created.id, revision: created.revision };
      refreshLists();
      if (s === scope.current && mounted.current && !closed.current) props.current.onCreated?.(created.id);
    };

    const send = (s = scope.current) => {
      clearTimeout(timer.current);
      timer.current = null;
      if (closed.current || s.inFlight || !pending.current) return;
      const { json } = pending.current;
      pending.current = null;
      setStatus((st) => ({ ...st, state: "saving" }));
      let retryIn = null;
      s.inFlight = (async () => {
        try {
          await write(s, json);
          if (s === scope.current) {
            lastSent.current = json;
            setStatus({ state: "saved", savedAt: new Date() });
          }
        } catch (err) {
          if (s !== scope.current) return;
          // Newer changes may have arrived meanwhile; otherwise try these again.
          if (!pending.current) pending.current = { json, since: Date.now() };
          const final = FINAL_STATUSES.includes(err.statusCode);
          if (!final) retryIn = RETRY_MS;
          setStatus((st) => ({ ...st, state: final ? "failed" : "error" }));
        } finally {
          s.inFlight = null;
          lastWriteAt.current = Date.now();
          if (s.discard) deleteDraft(s);
          else if (s === scope.current && !closed.current && pending.current) {
            if (retryIn) timer.current = setTimeout(send, retryIn);
            else schedule();
          }
        }
      })();
    };

    const schedule = () => {
      if (closed.current || !pending.current || scope.current.inFlight) return;
      clearTimeout(timer.current);
      const now = Date.now();
      const quiet = Math.min(QUIET_MS, Math.max(0, pending.current.since + MAX_WAIT_MS - now));
      const gap = Math.max(0, lastWriteAt.current + MIN_GAP_MS - now);
      timer.current = setTimeout(send, Math.max(quiet, gap));
    };

    const release = ({ flush = true } = {}) => {
      const old = scope.current;
      // The latest changes go to this draft first, so it's complete should the save fail.
      if (flush) send(old);
      clearTimeout(timer.current);
      timer.current = null;
      pending.current = null;
      scope.current = newScope();
      lastSent.current = null;
      setStatus({ state: "idle", savedAt: null });
      return () => {
        old.discard = true;
        // A write under way deletes its draft once it lands (see send's finally).
        if (!old.inFlight) deleteDraft(old);
      };
    };

    const clear = () => {
      release({ flush: false })();
      closed.current = true;
    };

    const adopt = ({ id, revision, content }) => {
      clearTimeout(timer.current);
      timer.current = null;
      pending.current = null;
      scope.current = newScope({ id, revision });
      lastSent.current = JSON.stringify(content);
    };

    const currentDraftId = () => scope.current.draft?.id ?? null;

    engine.current = { send, schedule, release, clear, adopt, currentDraftId };
  }

  const serialized = useMemo(() => (value ? JSON.stringify(value) : null), [value]);

  useEffect(() => {
    if (closed.current || !serialized || serialized === lastSent.current) return;
    // Nothing typed yet on a form with no draft: nothing to keep.
    if (!scope.current.draft && !dirty) {
      pending.current = null;
      return;
    }
    pending.current = { json: serialized, since: pending.current?.since ?? Date.now() };
    engine.current.schedule();
  }, [serialized, dirty]);

  // Hidden (another tab, the phone's home screen — often the last chance), closed, or left for
  // another page inside the portal: write now.
  useEffect(() => {
    mounted.current = true;
    const { send } = engine.current;
    const onHide = () => send();
    const onVisibility = () => document.visibilityState === "hidden" && send();
    // The browser's own "Leave site?" — only when the last changes can't be got out in time: a
    // write is already under way with newer changes waiting behind it, or the form is too large
    // to be sent on after the tab closes.
    const onBeforeUnload = (e) => {
      if (closed.current) return;
      send();
      if (pending.current || (scope.current.inFlight && !scope.current.keepalive)) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("pagehide", onHide);
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", onHide);
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("visibilitychange", onVisibility);
      mounted.current = false;
      send();
    };
  }, []);

  const { adopt, release, clear, currentDraftId } = engine.current;
  return { status, adopt, release, clear, currentDraftId };
}
