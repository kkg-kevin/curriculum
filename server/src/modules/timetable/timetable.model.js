const db = require("../../config/db");
const { createRecord, updateRecord, deleteRecord, firstOrNull } = require("../../shared/utils/model.utils");

const TABLE = "timetable_slots";

const TimetableModel = {
  findAll({ classId, teacherId, dayOfWeek } = {}) {
    let query = db(TABLE);
    if (classId) query = query.where({ classId });
    if (teacherId) query = query.where({ teacherId });
    if (dayOfWeek) query = query.where({ dayOfWeek });
    return query.orderBy("startTime", "asc");
  },

  // Scoped counterpart to findAll() for callers resolving slots across several classes at once
  // (e.g. a learner enrolled in multiple hubs, or every class a teacher is linked to) — avoids
  // loading every slot system-wide just to filter down to a handful of classes in JS.
  findByClassIds(classIds) {
    if (!classIds || classIds.length === 0) return [];
    return db(TABLE).whereIn("classId", classIds).orderBy("startTime", "asc");
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

  // Called from class.service.js's deleteClass — a class's own timetable has no meaning once
  // the class itself is gone.
  deleteByClassId(classId) {
    return db(TABLE).where({ classId }).del();
  },

  // Called from room.service.js's deleteRoom — a slot keeps its schedule, it just loses the
  // stale room reference, same posture as learner-hub-link.model.js's clearClassId.
  clearRoomId(roomId) {
    return db(TABLE).where({ roomId }).update({ roomId: null, updatedAt: new Date() });
  },
};

module.exports = TimetableModel;
