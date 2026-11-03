const { COOKIE_NAME } = require("../../config/env");

// The sign-in token a request carries: the httpOnly cookie, as normal — or, from a browser that
// won't keep cookies (cookies / site data blocked for the site, some in-app or privacy browsers),
// an `Authorization: Bearer <token>` header the portal sends instead (3 Nov 2026: people sign in
// whatever their browser does with cookies — see the client's services/fallbackSession.js). The
// portal sends it as `X-Session-Token` (some hosting strips `Authorization` before it reaches the
// app); a Bearer header works too. Same signed token, same session checks; the cookie wins.
function sessionTokenFrom(req) {
  const fromCookie = req.cookies?.[COOKIE_NAME];
  if (fromCookie) return fromCookie;
  const own = req.headers?.["x-session-token"];
  if (own) return String(own).trim() || null;
  const header = req.headers?.authorization || "";
  const match = /^Bearer\s+(\S+)$/i.exec(header);
  return match ? match[1] : null;
}

module.exports = { sessionTokenFrom };
