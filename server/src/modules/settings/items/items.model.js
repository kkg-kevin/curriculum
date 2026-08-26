const db = require("../../../config/db");
const { createRecord, updateRecord, deleteRecord, firstOrNull } = require("../../../shared/utils/model.utils");

const TABLE = "billing_items";

const ItemsModel = {
  findAll() {
    return db(TABLE).orderBy("name", "asc");
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

module.exports = ItemsModel;
