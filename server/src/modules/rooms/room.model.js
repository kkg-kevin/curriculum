const db = require("../../config/db");
const { createRecord, updateRecord, deleteRecord, firstOrNull } = require("../../shared/utils/model.utils");

const TABLE = "rooms";

const RoomModel = {
  create(data) {
    return createRecord(db, TABLE, data);
  },

  findAll({ hubId, status, ids } = {}) {
    let query = db(TABLE);
    if (hubId) query = query.where({ hubId });
    if (status) query = query.where({ status });
    if (ids) query = query.whereIn("id", ids);
    return query.orderBy("name", "asc");
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

module.exports = RoomModel;
