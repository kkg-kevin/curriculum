const db = require("../../config/db");
const {
  createRecord,
  updateRecord,
  deleteRecord,
  firstOrNull,
  stringifyJsonFields,
} = require("../../shared/utils/model.utils");

const TABLE = "events";
const JSON_FIELDS = ["classIds"];

const EventModel = {
  create(data) {
    return createRecord(db, TABLE, stringifyJsonFields(data, JSON_FIELDS));
  },

  findAll({ curriculumId, hubId } = {}) {
    let query = db(TABLE);
    if (curriculumId) query = query.where({ curriculumId });
    if (hubId) query = query.where({ hubId });
    return query.orderBy("createdAt", "desc");
  },

  findById(id) {
    return firstOrNull(db(TABLE).where({ id }));
  },

  // The deployment that generated a given auto-created Class, if any — a Class has no back-
  // reference of its own (see event.service.js's createEvent), so this scans the other
  // direction over each event's classIds. Used by the timetable engine to find an Event's
  // running dates for a class belonging to it.
  async findByClassId(classId) {
    const events = await db(TABLE);
    return events.find((e) => (e.classIds || []).includes(classId)) || null;
  },

  update(id, data) {
    return updateRecord(db, TABLE, id, stringifyJsonFields(data, JSON_FIELDS));
  },

  // Deliberately doesn't touch the underlying Class or Curriculum — an event's cohort/history
  // shouldn't vanish just because the event record itself is removed. Same caution as
  // learner/teacher deletion elsewhere in this codebase.
  delete(id) {
    return deleteRecord(db, TABLE, id);
  },
};

module.exports = EventModel;
