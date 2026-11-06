const db = require("../../../config/db");
const { generateId, filterDefined, firstOrNull, stringifyJsonFields } = require("../../../shared/utils/model.utils");

const TABLE = "assessment_issues";
const JSON_FIELDS = ["forLearnerIds"];

// The chosen learners an issue is for (assessment_issues.forLearnerIds), or null — the whole class.
function chosenLearnersOf(issue) {
  let ids = issue?.forLearnerIds;
  if (typeof ids === "string") {
    try { ids = JSON.parse(ids); } catch { ids = null; }
  }
  return Array.isArray(ids) ? ids : null;
}

// Whether an issue is for this learner: a class issue for the whole class, or one they were chosen for.
function isForLearner(issue, learnerId) {
  const chosen = chosenLearnersOf(issue);
  return !chosen || chosen.includes(learnerId);
}

// One record per "a teacher released this assessment to a specific class" — deliberately
// separate from a session's assessmentAttachments (which just means "this assessment was
// authored into this session's content"). Attaching happens while a course is being built and
// says nothing about whether any learner should see it yet; issuing is the teacher's explicit
// "this is live for my class now" action. A learner only ever sees an assessment via an Issue.
const AssessmentIssueModel = {
  chosenLearnersOf,
  isForLearner,

  async create(data) {
    const record = { ...filterDefined(data), id: generateId(), issuedAt: new Date() };
    await db(TABLE).insert(stringifyJsonFields(record, JSON_FIELDS));
    return record;
  },

  findAll({ assessmentId, sessionId, courseId, classId, learnerId, issuedBy, reissuedFromIssueId } = {}) {
    let query = db(TABLE);
    if (reissuedFromIssueId) query = query.where({ reissuedFromIssueId });
    if (assessmentId) query = query.where({ assessmentId });
    if (sessionId) query = query.where({ sessionId });
    if (courseId) query = query.where({ courseId });
    if (classId) query = query.where({ classId });
    if (learnerId) query = query.where({ learnerId });
    if (issuedBy) query = query.where({ issuedBy });
    return query.orderBy("issuedAt", "desc");
  },

  findById(id) {
    return firstOrNull(db(TABLE).where({ id }));
  },

  findOne({ assessmentId, sessionId, classId }) {
    return firstOrNull(db(TABLE).where({ assessmentId, sessionId, classId }));
  },

  // Idempotency check for a standalone diagnostic issue (see issueDiagnostic in
  // assessment-submission.service.js) — keyed by learner instead of class/session, since it
  // bypasses course/session attachment entirely. Also keyed by pathwayId/ageCategoryId
  // (both default null, matching course-progress issues which never set either): the same
  // sample assessment is sometimes reused as the configured diagnostic for more than one
  // Pathway, so matching on assessmentId+learnerId alone would wrongly treat a diagnostic
  // already issued for one area as satisfying a different area that happens to share it.
  // A reissue is never the standalone issue itself (it's another attempt at one), so it's left out.
  findOneStandalone({ assessmentId, learnerId, pathwayId = null, ageCategoryId = null }) {
    return firstOrNull(db(TABLE).where({ assessmentId, learnerId, pathwayId, ageCategoryId }).whereNull("reissuedFromIssueId"));
  },

  // A self-paced learner's own issue of one session's assessment (issueOnSessionComplete) — keyed
  // by session too, since one assessment can be attached to more than one session.
  findOneSelfPaced({ assessmentId, learnerId, sessionId }) {
    return firstOrNull(db(TABLE)
      .where({ assessmentId, learnerId, sessionId })
      .whereNull("classId").whereNull("reissuedFromIssueId").whereNull("pathwayId").whereNull("ageCategoryId"));
  },

  async update(id, data) {
    const count = await db(TABLE).where({ id }).update(stringifyJsonFields(filterDefined(data), JSON_FIELDS));
    if (count === 0) return null;
    return firstOrNull(db(TABLE).where({ id }));
  },

  async delete(id) {
    const count = await db(TABLE).where({ id }).del();
    return count > 0;
  },

  // Detaches a deleted teacher's attribution without touching the issue itself — a safe no-op for
  // records where issuedBy is "system" or an admin's user id rather than this teacher's.
  clearIssuedBy(teacherId) {
    return db(TABLE).where({ issuedBy: teacherId }).update({ issuedBy: null });
  },
};

module.exports = AssessmentIssueModel;
