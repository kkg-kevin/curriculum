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

  findAll({ issueId, assessmentId, learnerId, classId, status } = {}) {
    let query = db(TABLE);
    if (issueId) query = query.where({ issueId });
    if (assessmentId) query = query.where({ assessmentId });
    if (learnerId) query = query.where({ learnerId });
    if (classId) query = query.where({ classId });
    if (status) query = query.where({ status });
    return query.orderBy("updatedAt", "desc");
  },

  findById(id) {
    return firstOrNull(db(TABLE).where({ id }));
  },

  findOne({ issueId, learnerId }) {
    return firstOrNull(db(TABLE).where({ issueId, learnerId }));
  },

  update(id, data) {
    return updateRecord(db, TABLE, id, stringifyJsonFields(data, JSON_FIELDS));
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
