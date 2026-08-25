const db = require("../../config/db");
const { createRecord, updateRecord, deleteRecord, firstOrNull } = require("../../shared/utils/model.utils");

const TABLE = "teacher_availability_slots";

const TeacherAvailabilityModel = {
  findByTeacherId(teacherId) {
    return db(TABLE).where({ teacherId }).orderBy("startTime", "asc");
  },

  // Scoped counterpart to findByTeacherId for callers checking several teachers at once (e.g.
  // timetable.service.js's hasConflict, resolving co-teachers) — avoids one query per teacher.
  findByTeacherIds(teacherIds) {
    if (!teacherIds || teacherIds.length === 0) return [];
    return db(TABLE).whereIn("teacherId", teacherIds);
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

  deleteByTeacherId(teacherId) {
    return db(TABLE).where({ teacherId }).del();
  },
};

module.exports = TeacherAvailabilityModel;
