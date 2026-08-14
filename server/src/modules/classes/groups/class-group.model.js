const db = require("../../../config/db");
const { createRecord, updateRecord, deleteRecord, firstOrNull } = require("../../../shared/utils/model.utils");

const TABLE = "class_groups";

// Reusable, class-level groups (e.g. project teams) — set up once per class by a teacher and
// reused across every group-mode assessment issued to that class, rather than recreated per
// assessment. See class-group-member.model.js for membership.
const ClassGroupModel = {
  create({ classId, name }) {
    return createRecord(db, TABLE, { classId, name });
  },

  findAll({ classId } = {}) {
    let query = db(TABLE);
    if (classId) query = query.where({ classId });
    return query.orderBy("createdAt", "asc");
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

  deleteByClassId(classId) {
    return db(TABLE).where({ classId }).del();
  },
};

module.exports = ClassGroupModel;
