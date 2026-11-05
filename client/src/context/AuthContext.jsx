import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { authApi } from "../modules/auth/services/authApi";
import { AUTH_ENABLED } from "../config/authConfig";
import SessionTimeoutGuard from "../components/ui/SessionTimeoutGuard";
import {
  askOtherTabsForSession, broadcast, clearTabSignedIn, isTabSignedIn, markTabSignedIn, onTabMessage,
  resetActivityClock, setSignedOutReason,
} from "./session";
import { clearFallbackToken, getFallbackToken, setFallbackToken } from "../services/fallbackSession";

const AuthContext = createContext(null);

// The role a session really runs as — a hub lead's or TOT learner's session is shown under another
// role (`sessionRole` says which).
const sessionRoleOf = (u) => u?.sessionRole || u?.role;

// Whether two signed-in user objects are the same account in the same role (an account may sign in
// as several roles — a session runs as one).
const sameAccount = (a, b) => !!a && !!b && a.id === b.id && sessionRoleOf(a) === sessionRoleOf(b);

// When this tab last switched role — a page of the old role still on screen for a moment must not
// take the switch for a link into another role (RoleRoute's TOT learner hand-off).
let lastRoleSwitchAt = 0;
export const justSwitchedRole = () => Date.now() - lastRoleSwitchAt < 3000;

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
    clearFallbackToken();
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
        let me = await authApi.me();
        // A session left in Educator / TOT learner that this person no longer is (made Active,
        // withdrawn from training, or signed in before the TOT learner sign-in existed) moves to the
        // role they do hold — never a switch offered to an empty side.
        const holds = me?.roles || [];
        if (["teacher", "totLearner"].includes(sessionRoleOf(me)) && holds.length && !holds.includes(sessionRoleOf(me))) {
          const { sessionToken, ...switched } = await authApi.switchRole(holds[0]);
          if (getFallbackToken() && sessionToken) setFallbackToken(sessionToken);
          me = switched;
        }
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
    // Another tab switched role: the shared cookie is that role now, so this tab reopens as it
    // ("/" sends each role on to its own home).
    if (msg.type === "role-switched" && userRef.current && sessionRoleOf(userRef.current) !== msg.role) window.location.assign("/");
    // Someone signed in in another tab: the shared cookie is their sign-in now, so a tab showing a
    // different account reopens as theirs rather than showing one person while acting as another.
    // A tab on its own sign-in (fallback token) isn't affected by the cookie and stays as it is.
    if (msg.type === "signed-in" && userRef.current && !getFallbackToken() && !sameAccount(userRef.current, { id: msg.userId, role: msg.role })) {
      window.location.assign("/");
    }
  }), [endLocally]);

  // Backstop for browsers without tab messages: when a tab comes back into view, it checks the
  // cookie still signs in as the account it shows; if another sign-in replaced it, it reopens.
  // At most once every 10 seconds.
  useEffect(() => {
    if (!AUTH_ENABLED) return undefined;
    let lastCheck = 0;
    const check = () => {
      if (document.visibilityState !== "visible" || !userRef.current || getFallbackToken()) return;
      if (Date.now() - lastCheck < 10_000) return;
      lastCheck = Date.now();
      const shown = userRef.current;
      authApi.me().then((me) => {
        if (me && userRef.current === shown && !sameAccount(me, shown)) window.location.assign("/");
      }, () => {});
    };
    document.addEventListener("visibilitychange", check);
    return () => document.removeEventListener("visibilitychange", check);
  }, []);

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
    clearFallbackToken();
    const { sessionToken, ...loggedInUser } = await authApi.login(identifier, password);
    // The sign-in lives in a cookie. A browser that won't keep cookies for this site accepts the
    // password but drops the cookie — so check straight away, and if it was dropped, carry the
    // sign-in with each request instead (services/fallbackSession.js). Nothing is shown: the person
    // is simply signed in. Any other failure of the check (a network blip) is left to the next
    // request, as before.
    // The check asks WHO the cookie signs in as, not just whether it works (5 Nov 2026): a browser
    // that refused the new cookie but still holds another account's would otherwise show this
    // person while every request ran as the other one (a learner seeing "not linked").
    if (AUTH_ENABLED && sessionToken) {
      const cookieIsThisLogin = await authApi.me().then(
        (me) => sameAccount(me, loggedInUser),
        (err) => err?.statusCode !== 401,
      );
      if (!cookieIsThisLogin) setFallbackToken(sessionToken);
    }
    markTabSignedIn();
    resetActivityClock();
    setUser(loggedInUser);
    // Other tabs of this browser share the cookie, which is now this sign-in's — they reopen as it.
    broadcast({ type: "signed-in", userId: loggedInUser.id, role: sessionRoleOf(loggedInUser) });
    return loggedInUser;
  }, [queryClient]);

  // Another of the account's roles for this session (`user.roles`). Cached data belonged to the
  // other role's views, so it's cleared the same way as on login.
  const switchRole = useCallback(async (role) => {
    epochRef.current += 1;
    queryClient.clear();
    const { sessionToken, ...switched } = await authApi.switchRole(role);
    // The new role's sign-in replaces the old one wherever it's kept.
    if (getFallbackToken() && sessionToken) setFallbackToken(sessionToken);
    resetActivityClock();
    lastRoleSwitchAt = Date.now();
    setUser(switched);
    broadcast({ type: "role-switched", role: sessionRoleOf(switched) });
    return switched;
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
    <AuthContext.Provider value={{ user, loading, isAuthenticated: !!user, suspended, pendingPayment, login, switchRole, signup, logout, updateUser }}>
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

