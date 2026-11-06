const AttendanceModel = require("./attendance.model");

// "Today" as a plain YYYY-MM-DD calendar date, in UTC — same formula the client's todayStr()
// uses and the same one event.service.js already uses for its own date guards, so client and
// server agree on where the boundary is.
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

const AttendanceService = {
  // No locking (6 Nov 2026): a day's attendance can be marked late (a past session) and corrected
  // after it's saved — saving again updates each learner's mark for that day. Only a day that
  // hasn't come yet is refused.
  async markAttendance(classId, date, records, markedBy) {
    const today = todayStr();
    if (date > today) {
      const err = new Error(
        "This session hasn't happened yet — attendance can be marked from the session day on."
      );
      err.statusCode = 409;
      throw err;
    }

    const saved = await AttendanceModel.bulkMark(classId, date, records, markedBy);
    // Parents whose child has now attended enough of the class get the mid-course "how is the
    // mentor doing?" prompt (modules/mentor-reviews/) — in the background, never failing this save.
    setImmediate(() => require("../mentor-reviews/mentor-review.service").afterAttendance(classId)
      .catch((err) => console.error("[mentor-reviews] mid-course prompt failed:", err.message)));
    return saved;
  },

  async getByClassAndDate(classId, date) {
    return AttendanceModel.findByClassAndDate(classId, date);
  },

  async getHistory(filters) {
    return AttendanceModel.findAll(filters);
  },
};

module.exports = AttendanceService;
