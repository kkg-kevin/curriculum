import { useEffect } from "react";
import { authApi } from "../modules/auth/services/authApi";

// Session rules (server side: user-session.model.js / auth.middleware.js):
//   1. 30 minutes without user activity signs you out (SESSION_IDLE_MINUTES on the server).
//   2. Closing the last tab — or the browser — means signing in again.
//
// This module is the browser half: which tabs are signed in, and when the user was last active.

const TAB_KEY = "digifunzi:tab-signed-in"; // sessionStorage — per tab, survives refresh, gone on tab close
const ACTIVITY_KEY = "digifunzi:last-activity"; // localStorage — shared by every tab
const SIGNED_OUT_KEY = "digifunzi:signed-out-reason"; // sessionStorage — for the login page's notice
const CHANNEL_NAME = "digifunzi-session";

// The server is told about activity at most this often — it only needs to know the user is still
// there, not every click. Its idle check allows a minute of slack for this (see auth.service.js).
const ACTIVITY_PING_MS = 30 * 1000;

function safe(fn, fallback = null) {
  try { return fn(); } catch { return fallback; }
}

/* ── This tab's "signed in here" marker ─────────────────────────────────────────────────── */

export const markTabSignedIn = () => safe(() => sessionStorage.setItem(TAB_KEY, "1"));
export const clearTabSignedIn = () => safe(() => sessionStorage.removeItem(TAB_KEY));
export const isTabSignedIn = () => safe(() => sessionStorage.getItem(TAB_KEY) === "1", false);

/* ── Messages between this app's open tabs ──────────────────────────────────────────────── */

let channel = null;
function getChannel() {
  if (typeof BroadcastChannel === "undefined") return null;
  if (!channel) channel = new BroadcastChannel(CHANNEL_NAME);
  return channel;
}

export function broadcast(message) {
  getChannel()?.postMessage(message);
}

// Subscribes to messages from the app's other tabs. Returns an unsubscribe function.
export function onTabMessage(handler) {
  const ch = getChannel();
  if (!ch) return () => {};
  const listener = (event) => handler(event.data || {});
  ch.addEventListener("message", listener);
  return () => ch.removeEventListener("message", listener);
}

// A tab opened with no marker of its own (a brand-new tab, or the browser reopened) asks whether
// any other tab of the app is signed in. If one answers, this tab joins that sign-in; if none does
// within the wait, the user closed every tab since signing in, so they must sign in again.
export function askOtherTabsForSession(waitMs = 350) {
  const ch = getChannel();
  if (!ch) return Promise.resolve(false);
  return new Promise((resolve) => {
    const unsubscribe = onTabMessage((msg) => {
      if (msg.type === "session-here") { cleanup(); resolve(true); }
    });
    const timer = setTimeout(() => { cleanup(); resolve(false); }, waitMs);
    function cleanup() { clearTimeout(timer); unsubscribe(); }
    ch.postMessage({ type: "anyone-signed-in" });
  });
}

/* ── Last user activity, shared by every tab ────────────────────────────────────────────── */

let lastPingAt = 0;

export function getLastActivity() {
  return safe(() => Number(localStorage.getItem(ACTIVITY_KEY)) || 0, 0);
}

// Records that the user is active right now (in this tab — every tab reads the same value), and
// tells the server if it hasn't heard from us for a while. `force` pings immediately (the
// "Stay signed in" button). Errors are ignored: a 401 is handled globally by the api client.
export function noteUserActivity({ force = false } = {}) {
  const now = Date.now();
  safe(() => localStorage.setItem(ACTIVITY_KEY, String(now)));
  if (force || now - lastPingAt >= ACTIVITY_PING_MS) {
    lastPingAt = now;
    authApi.activity().catch(() => {});
  }
}

// A fresh sign-in starts the idle clock from zero (the shared value may be hours old).
export function resetActivityClock() {
  lastPingAt = Date.now();
  safe(() => localStorage.setItem(ACTIVITY_KEY, String(Date.now())));
}

/* ── Why the user was signed out (shown once on the login page) ─────────────────────────── */

// "idle:<minutes>" (timed out here) or "expired" (the server ended the session). Read and cleared
// separately — React's StrictMode double-runs initializers, so "read and clear" in one go would
// lose the notice in development.
export const setSignedOutReason = (reason) => safe(() => sessionStorage.setItem(SIGNED_OUT_KEY, reason));
export const peekSignedOutReason = () => safe(() => sessionStorage.getItem(SIGNED_OUT_KEY));
export const clearSignedOutReason = () => safe(() => sessionStorage.removeItem(SIGNED_OUT_KEY));

/* ── Keep-alive for screens where the user can be busy without touching anything ───────── */

// While `active` (e.g. a learner has an assessment open) and the tab is visible, count the user
// as active once a minute — reading a long question for 30 minutes shouldn't sign them out. A
// hidden tab (switched away, minimised) doesn't count, so an abandoned assessment still times out.
export function useKeepSessionAlive(active) {
  useEffect(() => {
    if (!active) return undefined;
    const tick = () => { if (document.visibilityState === "visible") noteUserActivity(); };
    tick();
    const interval = setInterval(tick, 60 * 1000);
    return () => clearInterval(interval);
  }, [active]);
}
