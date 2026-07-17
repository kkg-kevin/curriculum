const AttendanceModel = require("./attendance.model");

const AttendanceService = {
  async markAttendance(classId, date, records, markedBy) {
    return AttendanceModel.bulkMark(classId, date, records, markedBy);
  },

  async getByClassAndDate(classId, date) {
    return AttendanceModel.findByClassAndDate(classId, date);
  },

  async getHistory(filters) {
    return AttendanceModel.findAll(filters);
  },
};

module.exports = AttendanceService;
