const { COOKIE_NAME } = require("../../config/env");

// The sign-in token a request carries: the httpOnly cookie, as normal — or, from a browser that
// won't keep cookies (cookies / site data blocked for the site, some in-app or privacy browsers),
// an `Authorization: Bearer <token>` header the portal sends instead (3 Nov 2026: people sign in
// whatever their browser does with cookies — see the client's services/fallbackSession.js). The
// portal sends it as `X-Session-Token` (some hosting strips `Authorization` before it reaches the
// app); a Bearer header works too. Same signed token, same session checks.
//
// The tab's own X-Session-Token wins over the cookie (5 Nov 2026). The portal only sends it when
// the cookie isn't this tab's sign-in: the browser dropped the new cookie, or still holds another
// account's (one browser, two people — a learner's tab must never run as the educator who signed
// in after them). Then the cookie, then a Bearer header.
function ownHeaderToken(req) {
  const own = req.headers?.["x-session-token"];
  return own ? String(own).trim() || null : null;
}

function sessionTokenFrom(req) {
  const own = ownHeaderToken(req);
  if (own) return own;
  const fromCookie = req.cookies?.[COOKIE_NAME];
  if (fromCookie) return fromCookie;
  const header = req.headers?.authorization || "";
  const match = /^Bearer\s+(\S+)$/i.exec(header);
  return match ? match[1] : null;
}

// Whether this request runs on the tab's own token rather than the shared cookie — signing out or
// switching role there must leave the cookie (possibly another account's sign-in) alone.
const usesOwnToken = (req) => !!ownHeaderToken(req);

module.exports = { sessionTokenFrom, usesOwnToken };
