const test = require("node:test");
const assert = require("node:assert/strict");

// env.js refuses to load without these; the values are only used inside this test.
process.env.JWT_SECRET = "test-secret";
process.env.CLIENT_URL ||= "http://localhost:5173";
process.env.DB_USER ||= "test";
process.env.DB_PASSWORD ||= "test";
process.env.DB_NAME ||= "test";

const jwt = require("jsonwebtoken");
const { apiRateLimitKey } = require("../src/shared/middleware/rate-limit.middleware");

const signed = (sub, secret = "test-secret") => jwt.sign({ sub }, secret);

test("two signed-in users on one address are counted separately", () => {
  const a = apiRateLimitKey({ ip: "41.90.1.1", cookies: { token: signed("user-a") } });
  const b = apiRateLimitKey({ ip: "41.90.1.1", cookies: { token: signed("user-b") } });
  assert.equal(a, "user:user-a");
  assert.equal(b, "user:user-b");
});

test("a request with no token, or a token we did not sign, is counted by address", () => {
  assert.equal(apiRateLimitKey({ ip: "41.90.1.1", cookies: {} }), "41.90.1.1");
  assert.equal(apiRateLimitKey({ ip: "41.90.1.1", cookies: { token: "garbage" } }), "41.90.1.1");
  assert.equal(apiRateLimitKey({ ip: "41.90.1.1", cookies: { token: signed("user-a", "someone-else") } }), "41.90.1.1");
});
