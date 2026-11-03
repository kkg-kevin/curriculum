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

const { perAccountKey } = require("../src/shared/middleware/rate-limit.middleware");

test("sign-in attempts are counted per account, not per address", () => {
  const key = perAccountKey((req) => req.body?.identifier);
  const a = key({ ip: "41.90.1.1", body: { identifier: "Amina.K" } });
  const b = key({ ip: "41.90.1.1", body: { identifier: "brian" } });
  assert.notEqual(a, b);
  // The same account typed differently is still one account.
  assert.equal(a, key({ ip: "41.90.1.1", body: { identifier: "  amina.k " } }));
});

test("one account's failed sign-ins never lock out another account on the same address", async () => {
  const express = require("express");
  const rateLimit = require("express-rate-limit");
  const app = express();
  app.use(express.json());
  app.post(
    "/login",
    rateLimit({ windowMs: 60000, limit: 3, skipSuccessfulRequests: true, keyGenerator: perAccountKey((req) => req.body?.identifier) }),
    (req, res) => res.status(req.body.password === "right" ? 200 : 401).end(),
  );
  const server = app.listen(0);
  const url = `http://127.0.0.1:${server.address().port}/login`;
  const attempt = (identifier, password) =>
    fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ identifier, password }) }).then((r) => r.status);
  try {
    for (let i = 0; i < 3; i += 1) assert.equal(await attempt("amina", "wrong"), 401);
    assert.equal(await attempt("amina", "right"), 429, "the account that kept failing waits");
    assert.equal(await attempt("brian", "right"), 200, "everyone else on the same address signs in");
  } finally {
    server.close();
  }
});
