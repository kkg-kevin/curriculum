const fs   = require("fs");
const path = require("path");

const FILE = path.join(__dirname, "../../../data/course-curriculum.json");

function read()      { return fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, "utf8")) : []; }
function write(data) { fs.writeFileSync(FILE, JSON.stringify(data, null, 2)); }
function genId() {
  try { return require("crypto").randomUUID(); }
  catch { return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`; }
}

// Records which curricula a course has been added to — a course stays independent and
// reusable, it just gets referenced by a curriculum when needed, same as the competency links.
const CourseCurriculumLinkModel = {
  findByCourseId(courseId) {
    return read().filter((l) => l.courseId === courseId);
  },

  findByCurriculumId(curriculumId) {
    return read().filter((l) => l.curriculumId === curriculumId);
  },

  link(courseId, curriculumId) {
    const all = read();
    const existing = all.find((l) => l.courseId === courseId && l.curriculumId === curriculumId);
    if (existing) return existing;
    const item = { id: genId(), courseId, curriculumId, createdAt: new Date().toISOString() };
    all.push(item);
    write(all);
    return item;
  },

  unlink(courseId, curriculumId) {
    const all      = read();
    const filtered = all.filter((l) => !(l.courseId === courseId && l.curriculumId === curriculumId));
    if (filtered.length === all.length) return false;
    write(filtered);
    return true;
  },

  deleteByCourseId(courseId) {
    const all      = read();
    const filtered = all.filter((l) => l.courseId !== courseId);
    write(filtered);
  },

  deleteByCurriculumId(curriculumId) {
    const all      = read();
    const filtered = all.filter((l) => l.curriculumId !== curriculumId);
    write(filtered);
  },
};

module.exports = CourseCurriculumLinkModel;
