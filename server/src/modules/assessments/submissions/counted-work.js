const db = require("../../../config/db");

// Which of a learner's work counts — the one rule reports, competencies, the session checks and
// analytics all use (6 Nov 2026; before, each place had its own idea and they disagreed).
//
// A submission is LIVE while:
//   - its issue still stands (revoking for everyone deletes the issue — the work is kept, not counted);
//   - for a reissue, every attempt before it still stands (an orphaned reissue doesn't count);
//   - it isn't revoked for that learner (assessment_revocations, keyed by the class issue — the
//     chain's root — and covering every attempt).
// Of a learner's live MARKED attempts at one root, only the LATEST attempt counts — attempt order
// is the reissue chain (each reissue follows the attempt before it), never the marking date, so
// re-marking an earlier attempt never brings it back. With `published`, only attempts whose report
// is released are looked at: an attempt still unreleased leaves the earlier one standing.
// A submission with no issue at all (none exist today) is left counting, as it always was.

const CHUNK = 500;

async function inChunks(ids, fn) {
  const list = [...new Set(ids)].filter(Boolean);
  const out = [];
  for (let i = 0; i < list.length; i += CHUNK) out.push(...(await fn(list.slice(i, i + CHUNK))));
  return out;
}

// These issues plus every attempt before them (reissue → … → class issue), by id.
async function loadIssueChains(issueIds) {
  const issueById = new Map();
  let wanted = [...new Set(issueIds)].filter(Boolean);
  for (let depth = 0; wanted.length && depth < 50; depth += 1) {
    const rows = await inChunks(wanted, (ids) => db("assessment_issues").whereIn("id", ids));
    rows.forEach((row) => issueById.set(row.id, row));
    wanted = rows.map((row) => row.reissuedFromIssueId).filter((id) => id && !issueById.has(id));
  }
  return issueById;
}

// { root, attempt } for an issue — attempt 0 is the class issue itself, 1 its first reissue… —
// or null when the chain is broken (an attempt before it is gone).
function chainOf(issue, issueById) {
  let current = issue;
  let attempt = 0;
  for (let hops = 0; current?.reissuedFromIssueId && hops < 50; hops += 1) {
    const parent = issueById.get(current.reissuedFromIssueId);
    if (!parent) return null;
    current = parent;
    attempt += 1;
  }
  return current ? { root: current, attempt } : null;
}

// Of these entries ({ submission, root, attempt }), the one that counts per learner per root:
// the latest attempt; between two of the same attempt (never expected) the later marked. Pure.
function latestPerRoot(entries) {
  const best = new Map();
  for (const entry of entries) {
    const key = `${entry.root ? entry.root.id : `sub:${entry.submission.id}`}:${entry.submission.learnerId}`;
    const held = best.get(key);
    const later = !held
      || entry.attempt > held.attempt
      || (entry.attempt === held.attempt && new Date(entry.submission.gradedAt || 0) > new Date(held.submission.gradedAt || 0));
    if (later) best.set(key, entry);
  }
  return [...best.values()];
}

// Sorts submissions into live ones and the ones that count. Works for one learner or many
// (analytics). Each entry is { submission, issue, root, attempt } — root/issue null only for a
// submission with no issue.
async function sortWork(submissions, { published = false } = {}) {
  const issueById = await loadIssueChains(submissions.map((s) => s.issueId));
  const learnerIds = [...new Set(submissions.map((s) => s.learnerId))];
  const revoked = new Set((await inChunks(learnerIds, (ids) => db("assessment_revocations").whereIn("learnerId", ids).select("issueId", "learnerId")))
    .map((r) => `${r.issueId}:${r.learnerId}`));

  const live = [];
  for (const submission of submissions) {
    if (!submission.issueId) {
      live.push({ submission, issue: null, root: null, attempt: 0 });
      continue;
    }
    const issue = issueById.get(submission.issueId);
    if (!issue) continue;
    const chain = chainOf(issue, issueById);
    if (!chain) continue;
    if (revoked.has(`${chain.root.id}:${submission.learnerId}`)) continue;
    live.push({ submission, issue, root: chain.root, attempt: chain.attempt });
  }
  const marked = live.filter(({ submission: s }) => s.status === "graded" && (!published || s.reportPublished));
  return { live, counted: latestPerRoot(marked) };
}

async function sortLearnerWork(learnerId, options) {
  if (!learnerId) return { live: [], counted: [] };
  const submissions = await db("assessment_submissions").where({ learnerId });
  // JSON columns come back parsed from mysql2 already; the model's findAll is the same query.
  return sortWork(submissions, options);
}

// Whether an entry belongs to one of these sessions: its issue's session, or none recorded
// (older issues, standalone ones). `sessionIds` null = any session.
function inSessions(entry, sessionIds) {
  if (!sessionIds) return true;
  const sessionId = entry.root?.sessionId;
  return !sessionId || sessionIds.has(sessionId);
}

// The marked, released work that counts for this learner, kept per session: `forSession(id)` is
// the set of assessment ids done in that session (plus work with no session recorded).
async function publishedGradedBySession(learnerId) {
  const { counted } = await sortLearnerWork(learnerId, { published: true });
  const bySession = new Map();
  const anywhere = new Set();
  for (const entry of counted) {
    const sessionId = entry.root?.sessionId;
    if (!sessionId) { anywhere.add(entry.submission.assessmentId); continue; }
    (bySession.get(sessionId) || bySession.set(sessionId, new Set()).get(sessionId)).add(entry.submission.assessmentId);
  }
  return {
    forSession(sessionId) {
      return new Set([...(bySession.get(sessionId) || []), ...anywhere]);
    },
  };
}

module.exports = {
  loadIssueChains,
  chainOf,
  latestPerRoot,
  sortWork,
  sortLearnerWork,
  inSessions,
  publishedGradedBySession,
};
