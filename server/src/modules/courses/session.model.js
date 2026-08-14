const db = require("../../config/db");
const {
  createRecord,
  updateRecord,
  deleteRecord,
  firstOrNull,
  stringifyJsonFields,
  generateId,
} = require("../../shared/utils/model.utils");

const TABLE = "course_sessions";
const JSON_FIELDS = ["outcomes", "mainConcepts", "activities", "assessmentIds", "assessmentAttachments", "notes", "resources", "indicatorIds"];

const SessionModel = {
  create(data) {
    return createRecord(db, TABLE, stringifyJsonFields(data, JSON_FIELDS));
  },

  async createMany(sessionsData) {
    const now = new Date();
    const created = sessionsData.map((data) => ({
      ...stringifyJsonFields(data, JSON_FIELDS),
      id: generateId(),
      createdAt: now,
      updatedAt: now,
    }));
    if (created.length) await db(TABLE).insert(created);
    return sessionsData.map((data, i) => ({ ...data, id: created[i].id, createdAt: now, updatedAt: now }));
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
    return updateRecord(db, TABLE, id, stringifyJsonFields(data, JSON_FIELDS));
  },

  delete(id) {
    return deleteRecord(db, TABLE, id);
  },

  deleteByCourseId(courseId) {
    return db(TABLE).where({ courseId }).del();
  },
};

module.exports = SessionModel;
