import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { authApi } from "../modules/auth/services/authApi";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Rehydrate from the existing httpOnly session cookie (if any) on a fresh app load, instead
  // of always forcing a re-login — a page refresh should keep you signed in. A missing/expired/
  // invalid cookie 401s here, which just means "not logged in" (same as never having a
  // session), not an error to surface.
  useEffect(() => {
    authApi
      .me()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (identifier, password) => {
    const loggedInUser = await authApi.login(identifier, password);
    setUser(loggedInUser);
    return loggedInUser;
  }, []);

  const signup = useCallback(async (payload) => {
    return authApi.signup(payload);
  }, []);

  const logout = useCallback(async () => {
    await authApi.logout();
    setUser(null);
  }, []);

  // Shallow-merges a patch into the current session's user — e.g. after the header avatar
  // popover uploads a new photo, so the rest of the app reflects it immediately without a
  // round trip to GET /api/auth/me.
  const updateUser = useCallback((patch) => {
    setUser((prev) => (prev ? { ...prev, ...patch } : prev));
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, isAuthenticated: !!user, login, signup, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
