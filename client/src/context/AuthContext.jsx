import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { authApi } from "../modules/auth/services/authApi";
import { AUTH_ENABLED } from "../config/authConfig";
import SessionTimeoutGuard from "../components/ui/SessionTimeoutGuard";
import {
  askOtherTabsForSession, broadcast, clearTabSignedIn, isTabSignedIn, markTabSignedIn, onTabMessage,
  resetActivityClock, setSignedOutReason,
} from "./session";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();
  const userRef = useRef(null);
  useEffect(() => { userRef.current = user; }, [user]);

  // A suspended (deactivated) account IS logged in — `user` is a real session — but their
  // account is flagged. `user.suspended` carries the reason ("learner" | "teacher" | "hub") or
  // is falsy. The router locks a suspended session to the in-app "Account Suspended" page; the
  // server refuses every write. Exposed as its own `suspended` value for convenience.
  const suspended = user?.suspended || null;

  // Set only when `suspended === "payment"` (see auth.service.js's getPendingPayment) — the
  // bootcamp price/hub the auto-provisioned learner still owes, so the "Account Suspended"
  // screen can show it on every login/reload, not just the one-time website confirmation.
  const pendingPayment = user?.pendingPayment || null;

  // Signs this tab out without calling the server — used when the session is already over (ended
  // in another tab, or refused by the server). `reason` is shown once on the login page.
  const endLocally = useCallback((reason) => {
    clearTabSignedIn();
    if (reason) setSignedOutReason(reason);
    setUser(null);
    queryClient.clear();
  }, [queryClient]);

  // Rehydrate from the existing httpOnly session cookie (if any) on a fresh app load — a page
  // refresh keeps you signed in. But closing the tab or browser should NOT: a tab that has no
  // "signed in here" marker (a new tab, or the browser reopened) first asks the app's other open
  // tabs. If one is signed in, this tab joins it; if none is, the user closed every tab since
  // signing in, so whatever sign-in the cookie still carries is ended and they sign in again.
  // A missing/expired/invalid cookie 401s on /me, which just means "not logged in".
  //
  // Sign-in waits for this check (bootRef) — otherwise the "end the leftover sign-in" call could
  // land after a quick sign-in and end the new session instead. Runs are chained, and each one
  // stands down if a sign-in happened since it started (epochRef) or StrictMode unmounted it.
  const bootRef = useRef(Promise.resolve());
  const epochRef = useRef(0);
  useEffect(() => {
    let cancelled = false;
    const startEpoch = epochRef.current;
    const stale = () => cancelled || epochRef.current !== startEpoch;
    const run = async () => {
      if (stale()) return;
      if (AUTH_ENABLED && !isTabSignedIn()) {
        const joined = await askOtherTabsForSession();
        if (stale()) return;
        if (!joined) {
          await authApi.logout().catch(() => {});
          if (!stale()) { setUser(null); setLoading(false); }
          return;
        }
        markTabSignedIn();
      }
      try {
        const me = await authApi.me();
        if (!stale()) setUser(me);
      } catch {
        if (!stale()) setUser(null);
      } finally {
        if (!stale()) setLoading(false);
      }
    };
    bootRef.current = bootRef.current.then(run, run);
    return () => { cancelled = true; };
  }, []);

  // The app's other tabs: answer a new tab asking whether anyone is signed in, and follow a
  // sign-out made in another tab (they all share one cookie, so it's already over there).
  useEffect(() => onTabMessage((msg) => {
    if (msg.type === "anyone-signed-in" && userRef.current && isTabSignedIn()) broadcast({ type: "session-here" });
    if (msg.type === "signed-out" && userRef.current) endLocally(msg.reason);
  }), [endLocally]);

  // The server refused this session (see api.js) — idle too long there, or already ended.
  useEffect(() => {
    const onExpired = () => {
      if (!userRef.current && !isTabSignedIn()) return;
      broadcast({ type: "signed-out", reason: "expired" });
      endLocally("expired");
    };
    window.addEventListener("auth:session-expired", onExpired);
    return () => window.removeEventListener("auth:session-expired", onExpired);
  }, [endLocally]);

  // Clears every cached query on login/logout — without this, React Query keeps serving the
  // PREVIOUS session's cached responses (hubs, curricula, courses, assessments, ...) under their
  // same query keys for up to their staleTime (5 min, see main.jsx) after a different account
  // logs in on the same tab. That's always been a staleness bug, but it became a real cross-
  // tenant data leak once "admin" stopped being one interchangeable role: logging in as a
  // second admin right after the first, in the same tab, would briefly render the first admin's
  // cached tenant data as if it belonged to the second. Clearing on both login AND logout (not
  // just logout) covers the common case of switching accounts without an intermediate full page
  // reload.
  const login = useCallback(async (identifier, password) => {
    await bootRef.current;
    epochRef.current += 1;
    queryClient.clear();
    const loggedInUser = await authApi.login(identifier, password);
    markTabSignedIn();
    resetActivityClock();
    setUser(loggedInUser);
    return loggedInUser;
  }, [queryClient]);

  const signup = useCallback(async (payload) => {
    return authApi.signup(payload);
  }, []);

  // Signs out everywhere: the server session is ended and every open tab follows. `reason` (a
  // string, e.g. "idle:30") is only passed by the idle timeout — a click handler's event object
  // is ignored.
  const logout = useCallback(async (reason) => {
    const why = typeof reason === "string" ? reason : null;
    await authApi.logout().catch(() => {});
    broadcast({ type: "signed-out", reason: why });
    endLocally(why);
  }, [endLocally]);

  // Shallow-merges a patch into the current session's user — e.g. after the header avatar
  // popover uploads a new photo, so the rest of the app reflects it immediately without a
  // round trip to GET /api/auth/me.
  const updateUser = useCallback((patch) => {
    setUser((prev) => (prev ? { ...prev, ...patch } : prev));
  }, []);

  const signOutForInactivity = useCallback((minutes) => logout(`idle:${minutes}`), [logout]);

  return (
    <AuthContext.Provider value={{ user, loading, isAuthenticated: !!user, suspended, pendingPayment, login, signup, logout, updateUser }}>
      {children}
      {AUTH_ENABLED && user && (
        <SessionTimeoutGuard
          idleTimeoutMs={user.session?.idleTimeoutMs}
          onTimeout={signOutForInactivity}
          onSignOut={() => logout()}
        />
      )}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
