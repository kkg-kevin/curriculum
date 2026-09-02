const db = require("../../config/db");
const { generateId, firstOrNull, updateRecord } = require("../../shared/utils/model.utils");

const TABLE = "session_occurrences";

// A thin Knex wrapper over session_occurrences — see the migration
// (20260902100000_create_session_occurrences.js) for what the row means and why it exists.
// All business rules (when a row may be created, which state transitions are legal) live in
// session-occurrence.service.js; this file only reads and writes.
const SessionOccurrenceModel = {
  findByClassId(classId) {
    return db(TABLE).where({ classId }).orderBy("date", "asc");
  },

  findByClassAndCourse(classId, courseId) {
    return db(TABLE).where({ classId, courseId }).orderBy("date", "asc");
  },

  findById(id) {
    return firstOrNull(db(TABLE).where({ id }));
  },

  findOne(classId, sessionId, date) {
    return firstOrNull(db(TABLE).where({ classId, sessionId, date }));
  },

  // Every occurrence for a class on one calendar date — normally 0 or 1, but a class that (wrongly)
  // has two courses landing a session on the same day would surface both, which the caller can then
  // reconcile rather than silently seeing only one.
  findByClassAndDate(classId, date) {
    return db(TABLE).where({ classId, date });
  },

  async create(data) {
    const now = new Date();
    const record = {
      id: data.id || generateId(),
      classId: data.classId,
      courseId: data.courseId,
      sessionId: data.sessionId,
      date: data.date,
      status: data.status || "scheduled",
      taughtAt: data.taughtAt || null,
      taughtBy: data.taughtBy || null,
      attendanceState: data.attendanceState || "not_taken",
      attendanceLockedAt: data.attendanceLockedAt || null,
      attendanceLockedBy: data.attendanceLockedBy || null,
      note: data.note || null,
      createdAt: now,
      updatedAt: now,
    };
    await db(TABLE).insert(record);
    return record;
  },

  // Bulk insert used by the lazy sync — every row is brand-new (the caller has already diffed
  // against what exists), so this is a plain insert with no upsert/reconcile. Returns the rows
  // as written. A concurrent sync racing on the same (classId, sessionId, date) loses at the
  // unique index; callers treat ER_DUP_ENTRY as "someone else already created it" (benign).
  async bulkCreate(rows) {
    if (!rows.length) return [];
    const now = new Date();
    const records = rows.map((r) => ({
      id: generateId(),
      classId: r.classId,
      courseId: r.courseId,
      sessionId: r.sessionId,
      date: r.date,
      status: "scheduled",
      taughtAt: null,
      taughtBy: null,
      attendanceState: "not_taken",
      attendanceLockedAt: null,
      attendanceLockedBy: null,
      note: null,
      createdAt: now,
      updatedAt: now,
    }));
    await db(TABLE).insert(records);
    return records;
  },

  update(id, data) {
    return updateRecord(db, TABLE, id, data);
  },

  // Flip attendanceState in bulk for a set of ids — used both by the sync (mark 'taken' once
  // attendance rows appear) and the auto-lock sweep. Stamps updatedAt; leaves lock attribution
  // to the caller's `extra` (the sweep sets a system marker, a manual close sets the actor).
  async setAttendanceState(ids, attendanceState, extra = {}) {
    if (!ids.length) return 0;
    return db(TABLE).whereIn("id", ids).update({ attendanceState, updatedAt: new Date(), ...extra });
  },

  // Occurrences still sitting in not_taken whose date is on or before `cutoffDate` — the
  // auto-lock sweep's input set. Scoped to a class when classId is given (the on-demand sweep
  // from a completion check), unscoped for a cron-style sweep across every class.
  findStaleUnmarked(cutoffDate, classId = null) {
    let q = db(TABLE).where({ attendanceState: "not_taken" }).where("date", "<=", cutoffDate);
    if (classId) q = q.where({ classId });
    return q;
  },

  deleteByClassId(classId) {
    return db(TABLE).where({ classId }).del();
  },

  // Attribution cleanup, same posture as attendance.model.js's clearMarkedBy / session-skip's
  // clearCreatedBy — the occurrence record is real history and outlives the teacher who closed it.
  async clearActor(teacherId) {
    await Promise.all([
      db(TABLE).where({ taughtBy: teacherId }).update({ taughtBy: null }),
      db(TABLE).where({ attendanceLockedBy: teacherId }).update({ attendanceLockedBy: null }),
    ]);
  },
};

module.exports = SessionOccurrenceModel;
