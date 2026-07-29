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
// single Class.classTeacherId field. A course can have more than one educator (co-teachers,
// full access to that course within that class), and the same course can have different
// educators in different classes, same pattern as teacher-hub-link.model.js. Within one
// (classId, courseId) group, exactly one link carries isPrimary: true — the educator of
// record for attendance/grading/reports — while the rest are secondary co-teachers.
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
    // First educator assigned to this (class, course) pair becomes primary by default —
    // every other newly-added co-teacher joins as secondary until promoted.
    const isFirstInGroup = !all.some((l) => l.classId === classId && l.courseId === courseId);
    const item = { id: genId(), classId, courseId, teacherId, isPrimary: isFirstInGroup, createdAt: new Date().toISOString() };
    all.push(item);
    write(all);
    return item;
  },

  // Promotes one educator to primary within its (classId, courseId) group and demotes every
  // other link in that same group — enforces "only one primary at a time" as a write-time
  // invariant rather than a validation rule, so it can never drift out of sync.
  setPrimary(classId, courseId, teacherId) {
    const all = read();
    const target = all.find((l) => l.classId === classId && l.courseId === courseId && l.teacherId === teacherId);
    if (!target) return null;
    for (const l of all) {
      if (l.classId === classId && l.courseId === courseId) l.isPrimary = l.teacherId === teacherId;
    }
    write(all);
    return target;
  },

  unlink(classId, courseId, teacherId) {
    const all      = read();
    const removed  = all.find((l) => l.classId === classId && l.courseId === courseId && l.teacherId === teacherId);
    const filtered = all.filter((l) => !(l.classId === classId && l.courseId === courseId && l.teacherId === teacherId));
    if (filtered.length === all.length) return false;
    // Removing the primary co-teacher can't leave the group with none — promote whoever's
    // been on the course longest so there's always exactly one primary while any remain.
    if (removed?.isPrimary) {
      const remaining = filtered
        .filter((l) => l.classId === classId && l.courseId === courseId)
        .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      if (remaining.length > 0) remaining[0].isPrimary = true;
    }
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
