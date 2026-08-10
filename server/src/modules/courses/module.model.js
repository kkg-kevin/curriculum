const db = require("../../config/db");
const { createRecord, updateRecord, deleteRecord, firstOrNull } = require("../../shared/utils/model.utils");

const TABLE = "course_modules";

const ModuleModel = {
  create(data) {
    return createRecord(db, TABLE, data);
  },

  findAll() {
    return db(TABLE);
  },

  findByCourseId(courseId) {
    return db(TABLE).where({ courseId }).orderBy("order", "asc");
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

  deleteByCourseId(courseId) {
    return db(TABLE).where({ courseId }).del();
  },
};

module.exports = ModuleModel;
