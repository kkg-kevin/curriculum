const db = require("../../config/db");
const {
  createRecord,
  updateRecord,
  firstOrNull,
  stringifyJsonFields,
} = require("../../shared/utils/model.utils");

const TABLE = "reports";
const JSON_FIELDS = ["content"];

// One record per (learner, course, class, sessionId) — a point-in-time snapshot of that learner's
// graded assessments, plus their indicator breakdown and any remarks. sessionId is null for a
// course-level "final" report (combines every session) and a real id for a single session's own
// report. "draft" is visible only to admin/school/teacher (so a teacher can review before
// publishing); "published" additionally becomes visible to the learner/guardian — session reports
// are always created already published (see report.service.js's generateSessionReport).
//
// classId is part of the identity, not just a field: a learner can be enrolled at several hubs at
// once (see learner-hub-link.model.js), and two of those classes can each run the same course. On
// a (learner, course) key alone, the second teacher's "Generate" would silently overwrite the
// first teacher's report and hand back a record scoped to a class they can't even access.
const ReportModel = {
  create(data) {
    return createRecord(db, TABLE, stringifyJsonFields(data, JSON_FIELDS));
  },

  findAll({ classId, courseId, learnerId, status } = {}) {
    let query = db(TABLE);
    if (classId) query = query.where({ classId });
    if (courseId) query = query.where({ courseId });
    if (learnerId) query = query.where({ learnerId });
    if (status) query = query.where({ status });
    return query.orderBy("updatedAt", "desc");
  },

  // classId is required — see the identity note above. sessionId defaults to null (the course-
  // level final report); pass a session's id to look up that session's own report instead.
  findOne({ learnerId, courseId, classId, sessionId = null }) {
    return firstOrNull(db(TABLE).where({ learnerId, courseId, classId, sessionId }));
  },

  findById(id) {
    return firstOrNull(db(TABLE).where({ id }));
  },

  update(id, data) {
    return updateRecord(db, TABLE, id, stringifyJsonFields(data, JSON_FIELDS));
  },

  // Deleting a learner has to take their reports with it — nothing else can ever reach a report
  // whose learner is gone (every read path resolves the learner first), so leaving them behind
  // just accumulates unreachable rows. Called from learner.service.js's deleteLearner.
  deleteByLearnerId(learnerId) {
    return db(TABLE).where({ learnerId }).del();
  },
};

module.exports = ReportModel;
