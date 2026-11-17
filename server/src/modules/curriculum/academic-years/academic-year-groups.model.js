const db = require("../../../config/db");
const { createRecord, updateRecord, firstOrNull, whereInChunks } = require("../../../shared/utils/model.utils");

const TABLE = "academic_year_groups";

const AcademicYearGroupModel = {
  findByCurriculumId(curriculumId) {
    return db(TABLE).where({ curriculumId });
  },

  // Batch form of findByCurriculumId.
  findByCurriculumIds(curriculumIds) {
    return whereInChunks(db, TABLE, "curriculumId", curriculumIds);
  },

  findById(id) {
    return firstOrNull(db(TABLE).where({ id }));
  },

  create(data) {
    return createRecord(db, TABLE, data);
  },

  update(id, changes) {
    return updateRecord(db, TABLE, id, changes);
  },
};

module.exports = AcademicYearGroupModel;
