const db = require("../../config/db");
const { createRecord, updateRecord, deleteRecord, firstOrNull } = require("../../shared/utils/model.utils");

const TABLE = "classes";

const ClassModel = {
  create(data) {
    return createRecord(db, TABLE, data);
  },

  // limit/offset are optional and additive — omitted (as every current caller does), this
  // returns the full result set exactly as before.
  findAll({ schoolId, status, limit, offset } = {}) {
    let query = db(TABLE);
    if (schoolId) query = query.where({ schoolId });
    if (status) query = query.where({ status });
    // id as a secondary sort key breaks ties deterministically — several classes created in
    // the same bulk operation (e.g. Set Up Year) can share the exact same createdAt millisecond,
    // and without a tie-breaker, LIMIT/OFFSET pagination across two separate queries isn't
    // guaranteed to order those ties the same way both times, which can duplicate or skip rows
    // between pages.
    query = query.orderBy([{ column: "createdAt", order: "desc" }, { column: "id", order: "asc" }]);
    if (limit) query = query.limit(limit);
    if (offset) query = query.offset(offset);
    return query;
  },

  findById(id) {
    return firstOrNull(db(TABLE).where({ id }));
  },

  update(id, data) {
    return updateRecord(db, TABLE, id, data);
  },

  delete(id) {
    return deleteRecord(db, TABLE, id);
  },
};

module.exports = ClassModel;
