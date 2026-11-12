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

// ---- Sign-in from any network: shared, changing and forwarded addresses (13 Nov 2026) ----
const { hasOwnLimiter } = require("../src/shared/middleware/rate-limit.middleware");
const express = require("express");
const rateLimit = require("express-rate-limit");

// The app's limiters in miniature: the general /api one (with its skip) and the login one.
function miniApp({ trustProxy, generalLimit = 3, loginLimit = 3, windowMs = 60000 } = {}) {
  const app = express();
  if (trustProxy !== undefined) app.set("trust proxy", trustProxy);
  app.use(express.json());
  app.use("/api", rateLimit({ windowMs, limit: generalLimit, keyGenerator: apiRateLimitKey, skip: hasOwnLimiter }));
  app.post("/api/auth/login",
    rateLimit({ windowMs, limit: loginLimit, skipSuccessfulRequests: true, keyGenerator: perAccountKey((req) => req.body?.identifier) }),
    (req, res) => res.status(req.body.password === "right" ? 200 : 401).json({ ip: req.ip }));
  app.get("/api/public/thing", (req, res) => res.json({ ip: req.ip }));
  return app;
}
async function withServer(app, fn) {
  const server = app.listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  try { return await fn(base); } finally { server.close(); }
}
const login = (base, identifier, password, headers = {}) =>
  fetch(`${base}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify({ identifier, password }) });

test("only sign-in and password-reset requests skip the general limiter", () => {
  for (const [method, path] of [["POST", "/auth/login"], ["POST", "/AUTH/LOGIN/"], ["POST", "/auth/forgot-password"], ["POST", "/auth/reset-password"], ["GET", "/auth/reset-password/abc123"], ["POST", "/public/parent-sign-in"]]) {
    assert.equal(hasOwnLimiter({ method, path }), true, `${method} ${path}`);
  }
  for (const [method, path] of [["GET", "/auth/me"], ["POST", "/auth/signup"], ["POST", "/public/leads"], ["DELETE", "/auth/login"], ["POST", "/auth/login/extra/x"]]) {
    assert.equal(hasOwnLimiter({ method, path }), false, `${method} ${path}`);
  }
});

test("scenarios 1, 4, 5: a busy shared address (CGNAT, a school, the host's proxy) never stops sign-in", async () => {
  await withServer(miniApp({ generalLimit: 3 }), async (base) => {
    // Everyone else's anonymous traffic uses up the shared general allowance…
    for (let i = 0; i < 3; i += 1) assert.equal((await fetch(`${base}/api/public/thing`)).status, 200);
    assert.equal((await fetch(`${base}/api/public/thing`)).status, 429, "the general allowance is spent");
    // …and 25 different people on that same address still sign in.
    for (let i = 0; i < 25; i += 1) assert.equal((await login(base, `user${i}`, "right")).status, 200, `user${i}`);
  });
});

test("scenario 6: after a temporary block, the account signs in once the window has passed", async () => {
  await withServer(miniApp({ loginLimit: 2, windowMs: 300 }), async (base) => {
    assert.equal((await login(base, "amina", "wrong")).status, 401);
    assert.equal((await login(base, "amina", "wrong")).status, 401);
    assert.equal((await login(base, "amina", "right")).status, 429, "held after too many failures");
    assert.equal((await login(base, "brian", "right")).status, 200, "nobody else is held");
    await new Promise((r) => setTimeout(r, 450));
    assert.equal((await login(base, "amina", "right")).status, 200, "free again after the window");
  });
});

test("scenarios 7, 8: behind one trusted proxy the visitor's own address is used, and a forged one is ignored", async () => {
  // TRUST_PROXY=1: the last hop (added by our web server) is the visitor; anything before it is
  // whatever the visitor sent, and is ignored.
  await withServer(miniApp({ trustProxy: 1 }), async (base) => {
    const r = await login(base, "amina", "right", { "X-Forwarded-For": "6.6.6.6, 102.0.0.7" });
    assert.equal((await r.json()).ip, "102.0.0.7");
  });
  // TRUST_PROXY unset: forwarded headers are never believed.
  await withServer(miniApp({}), async (base) => {
    const r = await login(base, "amina", "right", { "X-Forwarded-For": "6.6.6.6" });
    assert.notEqual((await r.json()).ip, "6.6.6.6");
  });
});

test("scenarios 2, 3: a changing address (Starlink, mobile data) gets a fresh count, IPv6 counts by network", () => {
  const key = perAccountKey((req) => req.body?.identifier);
  // A new public address is a new count for that account — a user whose address changed isn't
  // stuck behind the old one's failures.
  assert.notEqual(key({ ip: "98.97.1.10", body: { identifier: "amina" } }), key({ ip: "98.97.2.20", body: { identifier: "amina" } }));
  // IPv6 (Starlink hands out IPv6 too) is counted by its /56 network, so one home's devices,
  // whose addresses rotate within it, share one count rather than evading it.
  assert.equal(
    key({ ip: "2605:59c8:1234:5600::1", body: { identifier: "amina" } }),
    key({ ip: "2605:59c8:1234:56ff::abcd", body: { identifier: "amina" } }),
  );
});

test("the activity log never records an address the visitor typed into a header", () => {
  const { clientOf } = require("../src/modules/audit/audit.service")._internal;
  const untrusted = { app: { get: () => false }, headers: { "x-forwarded-for": "6.6.6.6, 102.0.0.7" }, ip: "127.0.0.1" };
  assert.equal(clientOf(untrusted).ip, "102.0.0.7", "the hop our own web server added, not the forged first entry");
  const trusted = { app: { get: () => 1 }, headers: { "x-forwarded-for": "6.6.6.6, 102.0.0.7" }, ip: "102.0.0.7" };
  assert.equal(clientOf(trusted).ip, "102.0.0.7");
  assert.equal(clientOf({ app: { get: () => false }, headers: {}, ip: "::ffff:41.90.1.1" }).ip, "41.90.1.1");
});
