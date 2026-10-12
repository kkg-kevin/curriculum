const test = require("node:test");
const assert = require("node:assert/strict");
const bcrypt = require("bcryptjs");
const passwords = require("../src/shared/utils/password");

test("a password hashed here checks out, and a wrong one does not", async () => {
  const hash = await passwords.hash("correct horse battery", 10);
  assert.equal(await passwords.compare("correct horse battery", hash), true);
  assert.equal(await passwords.compare("wrong", hash), false);
});

test("hashes made before the change (plain bcryptjs) still check out, and the other way round", async () => {
  const old = await bcrypt.hash("existing-password", 10);
  assert.equal(await passwords.compare("existing-password", old), true);
  const fresh = await passwords.hash("new-password", 10);
  assert.equal(await bcrypt.compare("new-password", fresh), true);
});

test("the main thread stays responsive while many passwords are checked at once", async () => {
  const hash = await passwords.hash("pw", 10);
  let worstGap = 0;
  let last = Date.now();
  const timer = setInterval(() => {
    const now = Date.now();
    worstGap = Math.max(worstGap, now - last);
    last = now;
  }, 5);
  const results = await Promise.all(Array.from({ length: 30 }, () => passwords.compare("pw", hash)));
  clearInterval(timer);
  assert.ok(results.every(Boolean));
  // On the main thread 30 checks hold it for well over a second in one stretch.
  assert.ok(worstGap < 250, `main thread was held for ${worstGap} ms`);
});
