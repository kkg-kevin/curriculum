const db = require("../../../config/db");
const {
  createRecord,
  updateRecord,
  deleteRecord,
  firstOrNull,
  stringifyJsonFields,
} = require("../../../shared/utils/model.utils");

const TABLE = "learning_areas_catalog";
const JSON_FIELDS = ["courses"];

const LearningAreaModel = {
  findAll() {
    return db(TABLE);
  },

  findById(id) {
    return firstOrNull(db(TABLE).where({ id }));
  },

  findByIds(ids) {
    return db(TABLE).whereIn("id", ids);
  },

  create(data) {
    return createRecord(db, TABLE, stringifyJsonFields(data, JSON_FIELDS));
  },

  update(id, data) {
    return updateRecord(db, TABLE, id, stringifyJsonFields(data, JSON_FIELDS));
  },

  delete(id) {
    return deleteRecord(db, TABLE, id);
  },
};

module.exports = LearningAreaModel;
