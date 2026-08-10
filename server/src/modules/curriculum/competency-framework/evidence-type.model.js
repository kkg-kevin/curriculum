const db = require("../../../config/db");
const { createRecord, updateRecord, deleteRecord, firstOrNull } = require("../../../shared/utils/model.utils");

const TABLE = "evidence_types";

const EvidenceTypeModel = {
  findByCurriculumId(curriculumId) {
    return db(TABLE).where({ curriculumId }).orderBy("createdAt", "asc");
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

  deleteByCurriculumId(curriculumId) {
    return db(TABLE).where({ curriculumId }).del();
  },
};

module.exports = EvidenceTypeModel;
