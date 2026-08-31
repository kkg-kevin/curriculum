const AttendanceModel = require("./attendance.model");

// "Today" as a plain YYYY-MM-DD calendar date, in UTC — same formula the client's todayStr()
// uses and the same one program.service.js already uses for its own date guards, so client and
// server agree on where the boundary is.
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

const AttendanceService = {
  async markAttendance(classId, date, records, markedBy) {
    const today = todayStr();
    // Rule 1 — a session that has already passed (or hasn't happened yet) can't have its
    // attendance marked. Attendance is a same-day record of who was actually in the room.
    if (date < today) {
      const err = new Error(
        "This session has already passed — its attendance can no longer be marked."
      );
      err.statusCode = 409;
      throw err;
    }
    if (date > today) {
      const err = new Error(
        "This session hasn't happened yet — attendance can only be marked on the session day."
      );
      err.statusCode = 409;
      throw err;
    }

    // Rule 2 — attendance locks on the first save. Once recorded for a class on a given day it
    // can't be edited or overwritten; the teacher gets exactly one submission.
    const existing = await AttendanceModel.findByClassAndDate(classId, date);
    if (existing.length > 0) {
      const err = new Error(
        "Attendance for this session has already been recorded and can no longer be changed."
      );
      err.statusCode = 409;
      throw err;
    }

    try {
      return await AttendanceModel.bulkMark(classId, date, records, markedBy);
    } catch (e) {
      // Two saves landing at nearly the same instant: the check above passed for both, but the
      // unique (classId, date, learnerId) index lets only the first insert through. Surface the
      // loser as the same "already recorded" 409 rather than a raw 500.
      if (e.code === "ER_DUP_ENTRY") {
        const err = new Error(
          "Attendance for this session has already been recorded and can no longer be changed."
        );
        err.statusCode = 409;
        throw err;
      }
      throw e;
    }
  },

  async getByClassAndDate(classId, date) {
    return AttendanceModel.findByClassAndDate(classId, date);
  },

  async getHistory(filters) {
    return AttendanceModel.findAll(filters);
  },
};

module.exports = AttendanceService;
