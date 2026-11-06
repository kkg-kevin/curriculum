// Reissue and revoke end to end, against a throwaway database — only when one is named:
//
//   TEST_DB_NAME=digifunzi_nfr_test npm test
//
// Same set-up as submissions.db.test.js: the name must end in "_test", the database is created if
// missing and migrated, the rows added are removed at the end, and email is off for the run.
const test = require("node:test");
const assert = require("node:assert/strict");

const TEST_DB = process.env.TEST_DB_NAME;
const enabled = Boolean(TEST_DB);

if (enabled) {
  if (!/_test$/.test(TEST_DB)) throw new Error("TEST_DB_NAME must end in _test");
  process.env.BREVO_API_KEY = "";
  process.env.SMTP_HOST = "";
  process.env.MAIL_FROM = "";
  require("dotenv").config({ quiet: true });
  process.env.DB_NAME = TEST_DB;
}

test("reissue and revoke", { skip: !enabled && "set TEST_DB_NAME to run" }, async (t) => {
  const knex = require("knex");
  const knexConfig = require("../knexfile");
  const admin = knex({ ...knexConfig, connection: { ...knexConfig.connection, database: undefined } });
  await admin.raw("CREATE DATABASE IF NOT EXISTS ?? CHARACTER SET utf8mb4", [TEST_DB]);
  await admin.destroy();

  const env = require("../src/config/env");
  assert.ok(!env.BREVO_API_KEY && !env.SMTP_HOST, "email must be off for this run");
  assert.equal(env.DB_NAME, TEST_DB);

  const db = require("../src/config/db");
  await db.migrate.latest();
  t.after(() => db.destroy());

  const { reissueRevokeScenario } = require("./helpers/reissue-revoke-scenario");
  await reissueRevokeScenario(t, db);
});
