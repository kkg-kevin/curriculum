const db = require("../../config/db");
const {
  createRecord,
  updateRecord,
  deleteRecord,
  firstOrNull,
  stringifyJsonFields,
} = require("../../shared/utils/model.utils");

const TABLE = "programs";
const JSON_FIELDS = ["classIds"];

const ProgramModel = {
  create(data) {
    return createRecord(db, TABLE, stringifyJsonFields(data, JSON_FIELDS));
  },

  findAll({ curriculumId } = {}) {
    let query = db(TABLE);
    if (curriculumId) query = query.where({ curriculumId });
    return query.orderBy("createdAt", "desc");
  },

  findById(id) {
    return firstOrNull(db(TABLE).where({ id }));
  },

  // The deployment that generated a given auto-created Class, if any — a Class has no back-
  // reference of its own (see program.service.js's createProgram), so this scans the other
  // direction over each program's classIds. Used by the timetable engine to find a Program's
  // running dates for a class belonging to it.
  async findByClassId(classId) {
    const programs = await db(TABLE);
    return programs.find((p) => (p.classIds || []).includes(classId)) || null;
  },

  update(id, data) {
    return updateRecord(db, TABLE, id, stringifyJsonFields(data, JSON_FIELDS));
  },

  // Deliberately doesn't touch the underlying Class or Curriculum — a program's cohort/history
  // shouldn't vanish just because the program record itself is removed. Same caution as
  // learner/teacher deletion elsewhere in this codebase.
  delete(id) {
    return deleteRecord(db, TABLE, id);
  },
};

module.exports = ProgramModel;
