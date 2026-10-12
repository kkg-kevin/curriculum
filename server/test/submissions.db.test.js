// Runs against a throwaway database, and only when one is named:
//
//   TEST_DB_NAME=digifunzi_nfr_test npm test
//
// The name must end in "_test". The database is created if missing and brought up to date with
// the normal migrations; the rows this file adds are removed again at the end. Email is switched
// off for the run.
const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");

const TEST_DB = process.env.TEST_DB_NAME;
const enabled = Boolean(TEST_DB);

if (enabled) {
  if (!/_test$/.test(TEST_DB)) throw new Error("TEST_DB_NAME must end in _test");
  // Before anything reads the environment: this run must never send mail or touch the real database.
  process.env.BREVO_API_KEY = "";
  process.env.SMTP_HOST = "";
  process.env.MAIL_FROM = "";
  require("dotenv").config({ quiet: true });
  process.env.DB_NAME = TEST_DB;
}

test("assessment submissions under simultaneous requests", { skip: !enabled && "set TEST_DB_NAME to run" }, async (t) => {
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
  const Service = require("../src/modules/assessments/submissions/assessment-submission.service");

  const ids = { assessment: crypto.randomUUID(), issue: crypto.randomUUID(), learner: crypto.randomUUID() };
  const now = new Date();
  const columns = Object.keys(await db("assessments").columnInfo());
  const assessment = { id: ids.assessment, name: "Concurrency test", type: "quiz", createdAt: now, updatedAt: now };
  if (columns.includes("ownerAdminId")) assessment.ownerAdminId = crypto.randomUUID();
  if (columns.includes("items")) assessment.items = JSON.stringify([]);
  await db("assessments").insert(assessment);
  await db("assessment_issues").insert({ id: ids.issue, assessmentId: ids.assessment, learnerId: ids.learner, issuedAt: now });

  t.after(async () => {
    await db("assessment_submissions").where({ issueId: ids.issue }).del();
    await db("assessment_issues").where({ id: ids.issue }).del();
    await db("assessments").where({ id: ids.assessment }).del();
    await db("notifications").where({ recipientId: ids.learner }).del().catch(() => {});
    await db.destroy();
  });

  let submissionId;

  await t.test("opening the same assessment ten times at once gives one attempt, no errors", async () => {
    const opened = await Promise.all(
      Array.from({ length: 10 }, () => Service.getOrCreateSubmission({ issueId: ids.issue, learnerId: ids.learner }))
    );
    assert.equal(new Set(opened.map((s) => s.id)).size, 1);
    const rows = await db("assessment_submissions").where({ issueId: ids.issue, learnerId: ids.learner });
    assert.equal(rows.length, 1);
    submissionId = rows[0].id;
  });

  await t.test("saving a draft works while the attempt is in progress", async () => {
    const saved = await Service.saveDraft(submissionId, [{ itemId: "q1", value: "draft" }]);
    assert.equal(saved.status, "in_progress");
  });

  await t.test("ten Submits at once: exactly one is accepted, the rest are told it is already submitted", async () => {
    const results = await Promise.allSettled(
      Array.from({ length: 10 }, () => Service.submit(submissionId, [{ itemId: "q1", value: "final" }]))
    );
    const accepted = results.filter((r) => r.status === "fulfilled");
    const refused = results.filter((r) => r.status === "rejected");
    assert.equal(accepted.length, 1);
    assert.equal(refused.length, 9);
    for (const r of refused) assert.equal(r.reason.statusCode, 400);
  });

  await t.test("a draft save that arrives after Submit is refused and changes nothing", async () => {
    await assert.rejects(() => Service.saveDraft(submissionId, [{ itemId: "q1", value: "late autosave" }]), { statusCode: 400 });
    const row = await db("assessment_submissions").where({ id: submissionId }).first();
    assert.deepEqual(row.answers, [{ itemId: "q1", value: "final" }]);
    assert.notEqual(row.status, "in_progress");
  });
});
