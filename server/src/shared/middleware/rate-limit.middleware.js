const jwt = require("jsonwebtoken");
const { ipKeyGenerator } = require("express-rate-limit");
const { JWT_SECRET, COOKIE_NAME } = require("../../config/env");

// Who a request is counted against by the general /api limiter (app.js).
//
// A signed-in request is counted against its own account; anything else against its IP address,
// as before. Counting signed-in traffic by address meant a whole school — every learner behind
// one shared connection, each tab polling for notifications and an open assessment — drew on a
// single allowance and could be refused together. Only the token's signature is checked here (no
// database lookup); whether the session is still live is `protect`'s job, later.
function apiRateLimitKey(req) {
  const token = req.cookies?.[COOKIE_NAME];
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

module.exports = { apiRateLimitKey };
