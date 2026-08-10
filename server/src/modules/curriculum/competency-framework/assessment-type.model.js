const db = require("../../../config/db");
const {
  createRecord,
  updateRecord,
  deleteRecord,
  firstOrNull,
  stringifyJsonFields,
  toJson,
} = require("../../../shared/utils/model.utils");

const TABLE = "assessment_types";
const JSON_FIELDS = ["evidenceWeights"];

const AssessmentTypeModel = {
  findByCurriculumId(curriculumId) {
    return db(TABLE).where({ curriculumId }).orderBy("createdAt", "asc");
  },

  findById(id) {
    return firstOrNull(db(TABLE).where({ id }));
  },

  create(data) {
    // evidenceWeights always starts empty on create, same as the JSON-file era (set via a
    // separate scoring endpoint afterward).
    return createRecord(db, TABLE, { ...data, evidenceWeights: toJson([]) });
  },

  update(id, data) {
    return updateRecord(db, TABLE, id, stringifyJsonFields(data, JSON_FIELDS));
  },

  delete(id) {
    return deleteRecord(db, TABLE, id);
  },

  deleteByCurriculumId(curriculumId) {
    return db(TABLE).where({ curriculumId }).del();
  },
};

module.exports = AssessmentTypeModel;
