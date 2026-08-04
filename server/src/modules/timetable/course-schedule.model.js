const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const FILE = path.join(__dirname, "../../../data/timetable-course-schedules.json");

const generateId = () =>
  typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

const readAll = () => {
  if (!fs.existsSync(FILE)) return [];
  const raw = fs.readFileSync(FILE, "utf-8").trim();
  return raw ? JSON.parse(raw) : [];
};

const writeAll = (data) => {
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2), "utf-8");
};

// The calendar anchor for a (classId, courseId) pair — "this course's Session 1 lines up with
// this date." One record per pair; setSchedule upserts so re-setting a start date never creates
// a duplicate anchor.
const CourseScheduleModel = {
  findByClassId(classId) {
    return readAll().filter((s) => s.classId === classId);
  },

  findOne(classId, courseId) {
    return readAll().find((s) => s.classId === classId && s.courseId === courseId) || null;
  },

  setSchedule(classId, courseId, startDate) {
    const all = readAll();
    const index = all.findIndex((s) => s.classId === classId && s.courseId === courseId);
    if (index === -1) {
      const record = { id: generateId(), classId, courseId, startDate, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      all.push(record);
      writeAll(all);
      return record;
    }
    all[index] = { ...all[index], startDate, updatedAt: new Date().toISOString() };
    writeAll(all);
    return all[index];
  },

  // Called from class.service.js's deleteClass, same reasoning as TimetableModel.deleteByClassId
  // — a class's course start-date anchors have no meaning once the class itself is gone.
  deleteByClassId(classId) {
    const all = readAll();
    const filtered = all.filter((s) => s.classId !== classId);
    if (filtered.length !== all.length) writeAll(filtered);
    return all.length - filtered.length;
  },
};

module.exports = CourseScheduleModel;
