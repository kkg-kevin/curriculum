// Reissue and revoke rules that need no database: when a learner may be reissued an assessment
// (reissue.rules.js) and which attempt counts (counted-work.js).
const test = require("node:test");
const assert = require("node:assert/strict");
const { reissueBlockerFrom } = require("../src/modules/assessments/submissions/reissue.rules");
const { chainOf, latestPerRoot, inSessions } = require("../src/modules/assessments/submissions/counted-work");

const attempt = (status, extra = {}) => ({ submission: status ? { status, ...extra } : { status: "not_started" } });

test("reissue: only once the latest attempt is marked", () => {
  assert.equal(reissueBlockerFrom({ attempts: [attempt("graded")] }), null);
  assert.equal(reissueBlockerFrom({ attempts: [attempt("graded"), attempt("graded")] }), null);
  assert.match(reissueBlockerFrom({ attempts: [attempt(null)] }), /Hasn't handed it in/);
  assert.match(reissueBlockerFrom({ attempts: [attempt("in_progress")] }), /Hasn't handed it in/);
  assert.match(reissueBlockerFrom({ attempts: [attempt("submitted")] }), /Mark their latest attempt/);
  assert.match(reissueBlockerFrom({ attempts: [attempt("graded"), attempt(null)] }), /waiting for them/);
  assert.match(reissueBlockerFrom({ attempts: [attempt("graded"), attempt("in_progress")] }), /they've started it/);
  assert.match(reissueBlockerFrom({ attempts: [attempt("graded"), attempt("submitted")] }), /Mark their latest attempt/);
});

test("reissue: never for group work, revoked learners, learners who left or it wasn't issued to", () => {
  assert.match(reissueBlockerFrom({ groupMode: true, attempts: [attempt("graded")] }), /Group assessments/);
  assert.match(reissueBlockerFrom({ attempts: [attempt("graded", { groupId: "g1" })] }), /Group work/);
  assert.match(reissueBlockerFrom({ revoked: true, attempts: [attempt("graded")] }), /give it back/);
  assert.match(reissueBlockerFrom({ inClass: false, attempts: [attempt("graded")] }), /No longer in this class/);
  assert.match(reissueBlockerFrom({ issuedToThem: false, attempts: [attempt("graded")] }), /wasn't issued to them/);
});

test("attempt order is the reissue chain; a broken chain doesn't count", () => {
  const root = { id: "c", reissuedFromIssueId: null };
  const r1 = { id: "r1", reissuedFromIssueId: "c" };
  const r2 = { id: "r2", reissuedFromIssueId: "r1" };
  const byId = new Map([root, r1, r2].map((i) => [i.id, i]));
  assert.deepEqual(chainOf(r2, byId), { root, attempt: 2 });
  assert.deepEqual(chainOf(root, byId), { root, attempt: 0 });
  assert.equal(chainOf({ id: "x", reissuedFromIssueId: "gone" }, byId), null);
});

test("the latest attempt counts, even when an earlier one was marked later", () => {
  const root = { id: "c" };
  const first = { submission: { id: "s1", learnerId: "L", gradedAt: "2026-11-06T12:00:00Z" }, root, attempt: 0 };
  const second = { submission: { id: "s2", learnerId: "L", gradedAt: "2026-11-05T12:00:00Z" }, root, attempt: 1 };
  const other = { submission: { id: "s3", learnerId: "M", gradedAt: "2026-11-01T12:00:00Z" }, root, attempt: 0 };
  const kept = latestPerRoot([first, second, other]).map((e) => e.submission.id).sort();
  assert.deepEqual(kept, ["s2", "s3"]);
});

test("work counts in its own session only", () => {
  const entry = (sessionId) => ({ root: { sessionId } });
  const s1 = new Set(["s1"]);
  assert.equal(inSessions(entry("s1"), s1), true);
  assert.equal(inSessions(entry("s2"), s1), false);
  assert.equal(inSessions(entry(null), s1), true);
  assert.equal(inSessions(entry("s2"), null), true);
});
