const db = require("../../config/db");
const { generateId } = require("../../shared/utils/model.utils");

const TABLE = "timetable_course_schedules";

// The calendar anchor for a (classId, courseId) pair — "this course's Session 1 lines up with
// this date." One record per pair; setSchedule upserts so re-setting a start date never creates
// a duplicate anchor.
const CourseScheduleModel = {
  findByClassId(classId) {
    return db(TABLE).where({ classId });
  },

  findOne(classId, courseId) {
    return db(TABLE).where({ classId, courseId }).first().then((row) => row || null);
  },

  async setSchedule(classId, courseId, startDate) {
    const count = await db(TABLE).where({ classId, courseId }).update({ startDate, updatedAt: new Date() });
    if (count > 0) return db(TABLE).where({ classId, courseId }).first();
    const record = { id: generateId(), classId, courseId, startDate, createdAt: new Date(), updatedAt: new Date() };
    await db(TABLE).insert(record);
    return record;
  },

  // Called from class.service.js's deleteClass, same reasoning as TimetableModel.deleteByClassId
  // — a class's course start-date anchors have no meaning once the class itself is gone.
  deleteByClassId(classId) {
    return db(TABLE).where({ classId }).del();
  },
};

module.exports = CourseScheduleModel;
