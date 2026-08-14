const db = require("../../../config/db");
const {
  createRecord,
  updateRecord,
  deleteRecord,
  firstOrNull,
  stringifyJsonFields,
} = require("../../../shared/utils/model.utils");

const TABLE = "assessment_submissions";
const JSON_FIELDS = ["answers", "autoItemResults", "itemFeedback", "indicatorBreakdown"];

// One record per (issue, learner) — a learner's single attempt at an issued assessment.
const AssessmentSubmissionModel = {
  create(data) {
    return createRecord(db, TABLE, stringifyJsonFields(data, JSON_FIELDS));
  },

  findAll({ issueId, assessmentId, learnerId, classId, status, groupId } = {}) {
    let query = db(TABLE);
    if (issueId) query = query.where({ issueId });
    if (assessmentId) query = query.where({ assessmentId });
    if (learnerId) query = query.where({ learnerId });
    if (classId) query = query.where({ classId });
    if (status) query = query.where({ status });
    if (groupId) query = query.where({ groupId });
    return query.orderBy("updatedAt", "desc");
  },

  findById(id) {
    return firstOrNull(db(TABLE).where({ id }));
  },

  findOne({ issueId, learnerId }) {
    return firstOrNull(db(TABLE).where({ issueId, learnerId }));
  },

  // Every sibling submission sharing one group's attempt at one issue — the fan-out target set
  // assessment-submission.service.js writes to in lockstep on every draft/submit/grade for a
  // group-mode submission. Excludes nothing (callers filter out the primary row themselves where
  // that matters).
  findGroupSiblings(issueId, groupId) {
    return db(TABLE).where({ issueId, groupId });
  },

  update(id, data) {
    return updateRecord(db, TABLE, id, stringifyJsonFields(data, JSON_FIELDS));
  },

  // Same contract as update(), but only writes if the row is still "in_progress" — returns null
  // (no row updated) otherwise. Used by submit() for a group-mode submission's primary row, to
  // close the race where two group members tap Submit at nearly the same instant: only the
  // first write actually lands, and the second sees null and reports "already submitted" instead
  // of both racing to fan out conflicting updates.
  async updateIfInProgress(id, data) {
    const patch = stringifyJsonFields(data, JSON_FIELDS);
    delete patch.id;
    patch.updatedAt = new Date();
    const count = await db(TABLE).where({ id, status: "in_progress" }).update(patch);
    if (count === 0) return null;
    return firstOrNull(db(TABLE).where({ id }));
  },

  delete(id) {
    return deleteRecord(db, TABLE, id);
  },

  // Detaches a deleted teacher's attribution without touching the graded submission itself —
  // gradedBy and reportPublishedBy are independently settable (see grade()/publishReport() in
  // assessment-submission.service.js), so each is only cleared where it actually matches.
  async clearGradedBy(teacherId) {
    await Promise.all([
      db(TABLE).where({ gradedBy: teacherId }).update({ gradedBy: null }),
      db(TABLE).where({ reportPublishedBy: teacherId }).update({ reportPublishedBy: null }),
    ]);
  },
};

module.exports = AssessmentSubmissionModel;
