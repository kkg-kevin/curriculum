const db = require("../../../config/db");
const { generateId } = require("../../../shared/utils/model.utils");

const TABLE = "assessment_revocations";

// An issued assessment revoked for chosen learners (see the 20261105090000 migration). A row is
// keyed by the CLASS issue (a reissue's chain root) and covers every attempt the learner has at it
// — the class issue plus each reissue made from it. Revoking for the whole class deletes the
// issue instead (AssessmentSubmissionService.revokeIssue), and its rows with it.

// The class issue an issue belongs to: itself, or (a reissue) the root of its chain.
async function rootOf(issue) {
  let current = issue;
  for (let hops = 0; current?.reissuedFromIssueId && hops < 50; hops += 1) {
    const parent = await db("assessment_issues").where({ id: current.reissuedFromIssueId }).first();
    if (!parent) break;
    current = parent;
  }
  return current;
}

// Every issue id made from these (reissues of them, and of those).
async function descendantIds(issueIds) {
  const found = [];
  let frontier = [...issueIds];
  for (let depth = 0; frontier.length && depth < 50; depth += 1) {
    const next = await db("assessment_issues").whereIn("reissuedFromIssueId", frontier).pluck("id");
    found.push(...next);
    frontier = next;
  }
  return found;
}

const AssessmentRevocationModel = {
  rootOf,

  forIssue(issueId) {
    return db(TABLE).where({ issueId });
  },

  // Every issue id revoked for this learner — their revoked class issues and every reissue of them.
  async revokedIssueIds(learnerId) {
    if (!learnerId) return new Set();
    const roots = await db(TABLE).where({ learnerId }).pluck("issueId");
    if (!roots.length) return new Set();
    return new Set([...roots, ...(await descendantIds(roots))]);
  },

  // Whether this issue (a class issue or any reissue of one) is revoked for this learner.
  async isRevoked(issue, learnerId) {
    if (!issue || !learnerId) return false;
    const root = await rootOf(issue);
    if (!root) return false;
    return !!(await db(TABLE).where({ issueId: root.id, learnerId }).first("id"));
  },

  // The assessments of one session revoked for this learner in this class — no longer required of
  // them (reports, course progress, final report readiness).
  async revokedAssessmentIds(learnerId, classId, sessionId) {
    if (!learnerId || !sessionId) return new Set();
    const q = db(TABLE).where({ learnerId, sessionId });
    if (classId) q.where({ classId });
    return new Set(await q.pluck("assessmentId"));
  },

  // `issue` must be a class issue (a chain root). Learners already revoked are left as they are.
  async add(issue, learnerIds, revokedBy) {
    const already = new Set(await db(TABLE).where({ issueId: issue.id }).whereIn("learnerId", learnerIds).pluck("learnerId"));
    const rows = learnerIds.filter((id) => !already.has(id)).map((learnerId) => ({
      id: generateId(),
      issueId: issue.id,
      learnerId,
      assessmentId: issue.assessmentId,
      classId: issue.classId || null,
      sessionId: issue.sessionId || null,
      revokedBy: revokedBy || null,
      revokedAt: new Date(),
    }));
    if (rows.length) await db(TABLE).insert(rows);
    return rows.length;
  },

  async remove(issueId, learnerIds) {
    if (!learnerIds.length) return 0;
    return db(TABLE).where({ issueId }).whereIn("learnerId", learnerIds).del();
  },

  deleteForIssue(issueId) {
    return db(TABLE).where({ issueId }).del();
  },

  descendantIds,
};

module.exports = AssessmentRevocationModel;
