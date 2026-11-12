const jwt = require("jsonwebtoken");
const { ipKeyGenerator } = require("express-rate-limit");
const { JWT_SECRET } = require("../../config/env");
const { sessionTokenFrom } = require("../utils/session-token");

// Who a request is counted against by the general /api limiter (app.js).
//
// A signed-in request is counted against its own account; anything else against its IP address,
// as before. Counting signed-in traffic by address meant a whole school — every learner behind
// one shared connection, each tab polling for notifications and an open assessment — drew on a
// single allowance and could be refused together. Only the token's signature is checked here (no
// database lookup); whether the session is still live is `protect`'s job, later.
function apiRateLimitKey(req) {
  const token = sessionTokenFrom(req);
  if (token) {
    try {
      const { sub } = jwt.verify(token, JWT_SECRET, { ignoreExpiration: true });
      if (sub) return `user:${sub}`;
    } catch {
      // Not one of our tokens — counted by address below.
    }
  }
  return ipKeyGenerator(req.ip || "");
}

// Who a sign-in (or password reset) attempt is counted against: the address AND the account it
// names — `pick(req)` gives the username / email typed, or the reset token. Counted by address
// alone, everyone behind one address — every user, while the host's own web server sits in front
// and TRUST_PROXY is unset, or a whole school on one connection — shared one allowance, so a few
// people's typos locked out every account (3 Nov 2026, live). Now each account has its own:
// guessing one account's password is still capped, and nobody else is affected.
function perAccountKey(pick) {
  return (req) => {
    const account = String(pick(req) || "").trim().toLowerCase().slice(0, 200);
    return `${ipKeyGenerator(req.ip || "")}|${account}`;
  };
}

// Requests the general /api limiter leaves alone because they carry a stricter limiter of their
// own, counted per account (auth.routes.js, parent-signup.routes.js): signing in, asking for and
// using a password reset, the website's parent sign-in. Without this, everyone not yet signed in
// — every visitor of the public website too, all seen as one address while TRUST_PROXY is unset —
// drew on one shared general allowance, so a busy hour could refuse every sign-in with "Too many
// requests" (13 Nov 2026). Their own per-account limits still stop password guessing.
// `req.path` is relative to the /api mount; matching ignores case and a trailing slash, as Express does.
const OWN_LIMITER_PATHS = /^\/(auth\/(login|forgot-password|reset-password(\/[^/]+)?)|public\/parent-sign-in)\/?$/i;
const hasOwnLimiter = (req) => req.method === "POST" || req.method === "GET" ? OWN_LIMITER_PATHS.test(String(req.path || "")) : false;

module.exports = { apiRateLimitKey, perAccountKey, hasOwnLimiter };
