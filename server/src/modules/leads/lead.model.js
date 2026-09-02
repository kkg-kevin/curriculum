const db = require("../../config/db");
const { createRecord, updateRecord, firstOrNull } = require("../../shared/utils/model.utils");

const TABLE = "leads";

const LeadModel = {
  create(data) {
    return createRecord(db, TABLE, data);
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

  update(id, data) {
    return updateRecord(db, TABLE, id, data);
  },
};

module.exports = LeadModel;
