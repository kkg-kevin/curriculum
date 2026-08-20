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

  // Scoped counterpart to findAll() for callers building a session-count map for a known,
  // small set of courses (e.g. one curriculum version's content) rather than every course
  // system-wide — see curriculum-versions.service.js's getCurrentCourses.
  findByCourseIds(courseIds) {
    if (!courseIds || courseIds.length === 0) return [];
    return db(TABLE).whereIn("courseId", courseIds);
  },

  // Session counts grouped by course, computed in the DB — used by the full course catalog
  // listing (getAllCourses), which genuinely needs a count for every course, so scoping by
  // courseIds wouldn't help there. Selecting just courseId and a count avoids pulling every
  // session's full JSON content columns (outcomes, mainConcepts, activities, notes, resources)
  // over the wire just to count rows.
  async countPerCourse() {
    const rows = await db(TABLE).select("courseId").count({ count: "*" }).groupBy("courseId");
    return rows.map((r) => ({ courseId: r.courseId, count: Number(r.count) }));
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
