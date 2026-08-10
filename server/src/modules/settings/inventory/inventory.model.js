const db = require("../../../config/db");
const { createRecord, updateRecord, deleteRecord, firstOrNull } = require("../../../shared/utils/model.utils");

const TABLE = "inventory";

const InventoryModel = {
  findAll() {
    return db(TABLE);
  },
  findByIds(ids) {
    return db(TABLE).whereIn("id", ids);
  },
  findById(id) {
    return firstOrNull(db(TABLE).where({ id }));
  },
  create(data) {
    return createRecord(db, TABLE, data);
  },
  update(id, data) {
    return updateRecord(db, TABLE, id, data);
  },
  delete(id) {
    return deleteRecord(db, TABLE, id);
  },
};

module.exports = InventoryModel;
