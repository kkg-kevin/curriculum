const db = require("../../config/db");
const { generateId, firstOrNull } = require("../../shared/utils/model.utils");

const TABLE = "attendance";

const AttendanceModel = {
  findAll({ classId, learnerId, date, dateFrom, dateTo, status } = {}) {
    let query = db(TABLE);
    if (classId) query = query.where({ classId });
    if (learnerId) query = query.where({ learnerId });
    if (date) query = query.where({ date });
    if (dateFrom) query = query.where("date", ">=", dateFrom);
    if (dateTo) query = query.where("date", "<=", dateTo);
    if (status) query = query.where({ status });
    return query.orderBy("date", "desc");
  },

  findByClassAndDate(classId, date) {
    return db(TABLE).where({ classId, date });
  },

  findById(id) {
    return firstOrNull(db(TABLE).where({ id }));
  },

  // Saves a class's marks for a day — first time or a correction (6 Nov 2026, no locking). One
  // row per (classId, date, learnerId), the unique index: a learner already marked that day has
  // their status, note and marker updated in place (row id and createdAt kept); anyone new is
  // added. Learners left out of `records` keep whatever they had.
  async bulkMark(classId, date, records, markedBy) {
    const now = new Date();
    const rows = records.map((r) => ({
      id: generateId(),
      classId,
      date,
      learnerId: r.learnerId,
      status: r.status,
      notes: r.notes || "",
      markedBy,
      createdAt: now,
      updatedAt: now,
    }));

    if (rows.length) {
      await db(TABLE).insert(rows)
        .onConflict(["classId", "date", "learnerId"])
        .merge(["status", "notes", "markedBy", "updatedAt"]);
    }
    return db(TABLE).where({ classId, date });
  },

  async deleteByLearnerId(learnerId) {
    return db(TABLE).where({ learnerId }).del();
  },

  async deleteByClassId(classId) {
    return db(TABLE).where({ classId }).del();
  },

  // Detaches a deleted teacher's attribution without touching the attendance record itself —
  // the attendance history is real data and should survive the teacher who marked it leaving.
  clearMarkedBy(teacherId) {
    return db(TABLE).where({ markedBy: teacherId }).update({ markedBy: null, updatedAt: new Date() });
  },
};

module.exports = AttendanceModel;
