const fs   = require("fs");
const path = require("path");

const FILE = path.join(__dirname, "../../../data/class-course-teacher-links.json");

function read()      { return fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, "utf8")) : []; }
function write(data) { fs.writeFileSync(FILE, JSON.stringify(data, null, 2)); }
function genId() {
  try { return require("crypto").randomUUID(); }
  catch { return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`; }
}

// Records which educator(s) teach a given course within a given class — replaces the old
// single Class.classTeacherId field. A course can have more than one educator (equal peers,
// full access to that course within that class), and the same course can have different
// educators in different classes, same pattern as teacher-hub-link.model.js.
const ClassCourseTeacherLinkModel = {
  findByClassId(classId) {
    return read().filter((l) => l.classId === classId);
  },

  findByTeacherId(teacherId) {
    return read().filter((l) => l.teacherId === teacherId);
  },

  findByClassAndCourse(classId, courseId) {
    return read().filter((l) => l.classId === classId && l.courseId === courseId);
  },

  link(classId, courseId, teacherId) {
    const all = read();
    const existing = all.find((l) => l.classId === classId && l.courseId === courseId && l.teacherId === teacherId);
    if (existing) return existing;
    const item = { id: genId(), classId, courseId, teacherId, createdAt: new Date().toISOString() };
    all.push(item);
    write(all);
    return item;
  },

  unlink(classId, courseId, teacherId) {
    const all      = read();
    const filtered = all.filter((l) => !(l.classId === classId && l.courseId === courseId && l.teacherId === teacherId));
    if (filtered.length === all.length) return false;
    write(filtered);
    return true;
  },

  deleteByClassId(classId) {
    const all      = read();
    const filtered = all.filter((l) => l.classId !== classId);
    write(filtered);
  },

  deleteByTeacherId(teacherId) {
    const all      = read();
    const filtered = all.filter((l) => l.teacherId !== teacherId);
    write(filtered);
  },
};

module.exports = ClassCourseTeacherLinkModel;
