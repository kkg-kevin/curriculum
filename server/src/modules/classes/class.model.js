const db = require("../../config/db");
const { createRecord, updateRecord, deleteRecord, firstOrNull } = require("../../shared/utils/model.utils");

const TABLE = "classes";

const ClassModel = {
  create(data) {
    return createRecord(db, TABLE, data);
  },

  findAll({ schoolId, status } = {}) {
    let query = db(TABLE);
    if (schoolId) query = query.where({ schoolId });
    if (status) query = query.where({ status });
    return query.orderBy("createdAt", "desc");
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
