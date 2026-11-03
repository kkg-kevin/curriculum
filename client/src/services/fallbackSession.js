import { readSession, removeSession, writeSession } from "../utils/safeStorage";

// The sign-in normally lives in an httpOnly cookie the browser keeps. A browser that won't keep
// cookies for the site (cookies / site data blocked, some in-app and privacy browsers) still has
// to sign people in, quietly (3 Nov 2026): the token the login answer carries is then kept here —
// this tab only (sessionStorage, else memory) — and sent with every request as X-Session-Token
// (api.js; the server reads it in shared/utils/session-token.js). Empty whenever cookies work.
const KEY = "digifunzi:session-token";

export const getFallbackToken = () => readSession(KEY);
export const setFallbackToken = (token) => (token ? writeSession(KEY, token) : removeSession(KEY));
export const clearFallbackToken = () => removeSession(KEY);

// For requests made with fetch instead of the shared axios instance.
export function fallbackHeaders() {
  const token = getFallbackToken();
  return token ? { "X-Session-Token": token } : {};
}
