const db = require("../../../config/db");
const {
  createRecord,
  updateRecord,
  firstOrNull,
  stringifyJsonFields,
} = require("../../../shared/utils/model.utils");

const TABLE = "curriculum_versions";
const JSON_FIELDS = ["content"];

const CurriculumVersionModel = {
  findAll() {
    return db(TABLE);
  },

  findAllByCurriculumId(curriculumId) {
    return db(TABLE).where({ curriculumId }).orderBy("versionNumber", "desc");
  },

  findById(id) {
    return firstOrNull(db(TABLE).where({ id }));
  },

  create(data) {
    return createRecord(db, TABLE, stringifyJsonFields(data, JSON_FIELDS));
  },

  update(id, changes) {
    return updateRecord(db, TABLE, id, stringifyJsonFields(changes, JSON_FIELDS));
  },

  deleteByCurriculumId(curriculumId) {
    return db(TABLE).where({ curriculumId }).del();
  },
};

module.exports = CurriculumVersionModel;
