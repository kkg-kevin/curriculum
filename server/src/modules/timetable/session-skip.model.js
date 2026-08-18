const db = require("../../config/db");
const { createRecord, deleteRecord, firstOrNull } = require("../../shared/utils/model.utils");

const TABLE = "timetable_session_skips";

const SessionSkipModel = {
  findByClassId(classId) {
    return db(TABLE).where({ classId }).orderBy("date", "asc");
  },

  findById(id) {
    return firstOrNull(db(TABLE).where({ id }));
  },

  findOne(classId, courseId, date) {
    return firstOrNull(db(TABLE).where({ classId, courseId, date }));
  },

  // A "move" skip's target date, not its origin — see createSkip's pre-check in
  // timetable.service.js for why this needs its own lookup (the "already rescheduled" check
  // above is keyed by origin date, which says nothing about whether some OTHER session has
  // already been moved onto this same target date).
  findByNewDate(classId, courseId, newDate) {
    return firstOrNull(db(TABLE).where({ classId, courseId, newDate }));
  },

  create(data) {
    return createRecord(db, TABLE, data, { updatedAt: false });
  },

  delete(id) {
    return deleteRecord(db, TABLE, id);
  },

  // Called from class.service.js's deleteClass — a class's skip history has no meaning once the
  // class itself is gone, same reasoning as TimetableModel/CourseScheduleModel's own cleanup.
  deleteByClassId(classId) {
    return db(TABLE).where({ classId }).del();
  },

  // Attribution cleanup, same posture as attendance.model.js's clearMarkedBy — the skip record
  // is real history and outlives the teacher who created it.
  clearCreatedBy(teacherId) {
    return db(TABLE).where({ createdBy: teacherId }).update({ createdBy: null });
  },
};

module.exports = SessionSkipModel;
