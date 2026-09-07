const db = require("../../config/db");
const {
  createRecord,
  updateRecord,
  deleteRecord,
  firstOrNull,
  stringifyJsonFields,
  withOwnerScope,
} = require("../../shared/utils/model.utils");

const TABLE = "assessments";
const JSON_FIELDS = ["sections", "items", "rubric", "indicators", "deliverables", "milestones"];

const AssessmentModel = {
  create(data) {
    return createRecord(db, TABLE, stringifyJsonFields(data, JSON_FIELDS));
  },

  // Every caller of this module is admin-role (assessments/routes.js is entirely admin-only,
  // unlike courses/curricula which also serve school/teacher/learner) — so ownerAdminId is
  // mandatory here via withOwnerScope, not the optional "if (x) query.where(x)" pattern used
  // where a route is genuinely shared with non-admin roles. A missing ownerAdminId throws
  // immediately instead of silently returning every tenant's assessments (see withOwnerScope's
  // own comment for why that asymmetry matters) — this caught a real bug during development
  // (attachOwnRecords wasn't mounted on /api/assessments, so req.ownerAdminId was always
  // undefined; the optional-filter version silently returned everyone's assessments).
  findAll({ type, ownerAdminId } = {}) {
    let query = withOwnerScope(db(TABLE), ownerAdminId);
    if (type) query = query.where({ type });
    return query.orderBy("createdAt", "desc");
  },

  findById(id) {
    return firstOrNull(db(TABLE).where({ id }));
  },

  update(id, data) {
    return updateRecord(db, TABLE, id, stringifyJsonFields(data, JSON_FIELDS));
  },

  delete(id) {
    return deleteRecord(db, TABLE, id);
  },
};

module.exports = AssessmentModel;
