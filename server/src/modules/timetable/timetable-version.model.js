const db = require("../../config/db");
const { generateId } = require("../../shared/utils/model.utils");

const TABLE = "timetable_slot_versions";

// How a lesson used to be, up to `validTo` (see migration 20261123120000). The calendar reads these
// for dates before a change, so past sessions stay on the day and time they really happened.
const TimetableVersionModel = {
  findByClassId(classId) {
    return db(TABLE).where({ classId }).orderBy("startTime", "asc");
  },

  findByClassIds(classIds) {
    if (!classIds?.length) return [];
    return db(TABLE).whereIn("classId", classIds).orderBy("startTime", "asc");
  },

  // Old versions still in force on or after `from` (a change that starts later).
  findEndingOnDay(dayOfWeek, from) {
    return db(TABLE).where({ dayOfWeek }).where("validTo", ">=", from);
  },

  async create(row, connection = db) {
    const now = new Date();
    const record = { id: generateId(), createdAt: now, updatedAt: now, ...row };
    await connection(TABLE).insert(record);
    return record;
  },

  deleteByClassId(classId) {
    return db(TABLE).where({ classId }).del();
  },

  clearRoomId(roomId) {
    return db(TABLE).where({ roomId }).update({ roomId: null, updatedAt: new Date() });
  },
};

module.exports = TimetableVersionModel;
