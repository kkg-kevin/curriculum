const db = require("../../config/db");
const { createRecord, updateRecord, firstOrNull, stringifyJsonFields } = require("../../shared/utils/model.utils");

const TABLE = "leads";

const LeadModel = {
  // visitSource is a JSON column (how the family found the website — leads/visit-source.js).
  async create(data) {
    const record = await createRecord(db, TABLE, stringifyJsonFields(data, ["visitSource"]));
    return { ...record, visitSource: data.visitSource ?? null };
  },

  findById(id) {
    return firstOrNull(db(TABLE).where({ id }));
  },

  // Admin Enquiries list — most-recent-first, optionally narrowed to one status/source so the
  // list page's filter tabs (New / Contacted / Closed) don't need to paginate through everything
  // client-side. No hard cap: unlike notifications this IS the record staff work through, so
  // nothing should silently fall off the end.
  findAll({ status, source } = {}) {
    const query = db(TABLE).orderBy("createdAt", "desc");
    if (status) query.where({ status });
    if (source) query.where({ source });
    return query;
  },

  countByStatus() {
    return db(TABLE).select("status").count({ count: "*" }).groupBy("status");
  },

  // The bootcamp-enrollment lead that provisioned a given learner (see
  // bootcamp-enrollment.service.js) — used by the learner's own "what do I owe" lookup
  // (auth.controller.js's getPendingPayment). A learner has at most one such lead in practice
  // (one enrollment per signup), so the most recent is the right one if more than one exists.
  findByLearnerId(learnerId) {
    return firstOrNull(db(TABLE).where({ learnerId }).orderBy("createdAt", "desc"));
  },

  update(id, data) {
    return updateRecord(db, TABLE, id, data);
  },
};

module.exports = LeadModel;
