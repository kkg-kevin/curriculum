const db = require("../../../config/db");
const {
  createRecord,
  updateRecord,
  firstOrNull,
  stringifyJsonFields,
} = require("../../../shared/utils/model.utils");

const TABLE = "academic_year_versions";
const JSON_FIELDS = ["periods"];

const AcademicYearVersionModel = {
  findByGroupId(yearGroupId) {
    return db(TABLE).where({ yearGroupId });
  },

  findByCurriculumId(curriculumId) {
    return db(TABLE).where({ curriculumId });
  },

  findById(id) {
    return firstOrNull(db(TABLE).where({ id }));
  },

  findPublished(curriculumId) {
    return firstOrNull(db(TABLE).where({ curriculumId, status: "published" }));
  },

  create(data) {
    const record = createRecord(db, TABLE, stringifyJsonFields(data, JSON_FIELDS));
    return record.then((created) => ({
      ...created,
      periods: typeof created.periods === "string" ? JSON.parse(created.periods) : created.periods,
    }));
  },

  update(id, changes) {
    return updateRecord(db, TABLE, id, stringifyJsonFields(changes, JSON_FIELDS));
  },

  // Demote all versions in a group to isCurrent: false
  setGroupNotCurrent(yearGroupId) {
    return db(TABLE).where({ yearGroupId }).update({ isCurrent: false, updatedAt: new Date() });
  },
};

module.exports = AcademicYearVersionModel;
