const db = require("../../../config/db");
const { generateId, filterDefined, firstOrNull } = require("../../../shared/utils/model.utils");

const TABLE = "assessment_issues";

// One record per "a teacher released this assessment to a specific class" — deliberately
// separate from a session's assessmentAttachments (which just means "this assessment was
// authored into this session's content"). Attaching happens while a course is being built and
// says nothing about whether any learner should see it yet; issuing is the teacher's explicit
// "this is live for my class now" action. A learner only ever sees an assessment via an Issue.
const AssessmentIssueModel = {
  async create(data) {
    const record = { ...filterDefined(data), id: generateId(), issuedAt: new Date() };
    await db(TABLE).insert(record);
    return record;
  },

  findAll({ assessmentId, sessionId, courseId, classId, learnerId, issuedBy } = {}) {
    let query = db(TABLE);
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
  // bypasses course/session attachment entirely. Also keyed by learningAreaId/ageCategoryId
  // (both default null, matching course-progress issues which never set either): the same
  // sample assessment is sometimes reused as the configured diagnostic for more than one
  // Learning Area, so matching on assessmentId+learnerId alone would wrongly treat a diagnostic
  // already issued for one area as satisfying a different area that happens to share it.
  findOneStandalone({ assessmentId, learnerId, learningAreaId = null, ageCategoryId = null }) {
    return firstOrNull(db(TABLE).where({ assessmentId, learnerId, learningAreaId, ageCategoryId }));
  },

  async update(id, data) {
    const count = await db(TABLE).where({ id }).update(filterDefined(data));
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
