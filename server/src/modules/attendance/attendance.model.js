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

  // Attendance is write-once per class+date (see AttendanceService.markAttendance, which rejects
  // a second save before this is ever reached). A plain insert of the whole set — no prior rows
  // exist to reconcile against. The unique (classId, date, learnerId) index is the last-line
  // guard against a concurrent double-submit: the loser's insert fails outright rather than
  // silently overwriting, matching the "locked on first save" contract.
  async bulkMark(classId, date, records, markedBy) {
    const now = new Date();
    const created = records.map((r) => ({
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

    if (created.length) await db(TABLE).insert(created);
    return created;
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
