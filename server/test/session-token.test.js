const test = require("node:test");
const assert = require("node:assert/strict");

// env.js refuses to load without these; the values are only used inside this test.
process.env.JWT_SECRET ||= "test-secret";
process.env.CLIENT_URL ||= "http://localhost:5173";
process.env.DB_USER ||= "test";
process.env.DB_PASSWORD ||= "test";
process.env.DB_NAME ||= "test";

const { sessionTokenFrom } = require("../src/shared/utils/session-token");

test("the sign-in cookie is used when the browser kept it", () => {
  assert.equal(sessionTokenFrom({ cookies: { token: "from-cookie" }, headers: { authorization: "Bearer from-header" } }), "from-cookie");
});

test("a browser that won't keep cookies signs in with the Bearer header instead", () => {
  assert.equal(sessionTokenFrom({ cookies: {}, headers: { authorization: "Bearer from-header" } }), "from-header");
  assert.equal(sessionTokenFrom({ headers: { authorization: "bearer  from-header" } }), "from-header");
});

test("no cookie and no (or a malformed) header is not signed in", () => {
  assert.equal(sessionTokenFrom({ cookies: {}, headers: {} }), null);
  assert.equal(sessionTokenFrom({ cookies: {}, headers: { authorization: "Basic abc" } }), null);
  assert.equal(sessionTokenFrom({ cookies: {}, headers: { authorization: "Bearer" } }), null);
});

test("the portal's own X-Session-Token header works too", () => {
  assert.equal(sessionTokenFrom({ cookies: {}, headers: { "x-session-token": "from-own-header" } }), "from-own-header");
});
