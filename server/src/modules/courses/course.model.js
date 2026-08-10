const db = require("../../config/db");
const {
  createRecord,
  updateRecord,
  deleteRecord,
  firstOrNull,
  stringifyJsonFields,
} = require("../../shared/utils/model.utils");

// Canonical shape (enforced at write time by course.validation.js's createCourseSchema, not
// here — same posture as every other model in this codebase): id, name, code, status,
// description, coverImage, ageMin, ageMax, requirements[], createdAt, updatedAt.
// Read directly (no accessor, no optional chaining needed beyond a null findById check) by
// timetable.service.js, reports/report.service.js, and curriculum/versions/curriculum-versions
// .service.js — a field rename here needs those three call sites updated too; nothing will
// throw if you miss one, it'll just render blank.
const TABLE = "courses";
const JSON_FIELDS = ["requirements"];

const CourseModel = {
  create(data) {
    return createRecord(db, TABLE, stringifyJsonFields(data, JSON_FIELDS));
  },

  findAll() {
    return db(TABLE).orderBy("createdAt", "desc");
  },

  findById(id) {
    return firstOrNull(db(TABLE).where({ id }));
  },

  update(id, data) {
    return updateRecord(db, TABLE, id, stringifyJsonFields(data, JSON_FIELDS));
  },

  delete(id) {
    return deleteRecord(db, TABLE, id);
  },
};

module.exports = CourseModel;
