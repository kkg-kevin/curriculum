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

module.exports = { apiRateLimitKey, perAccountKey };
