const fs   = require("fs");
const path = require("path");

const FILE = path.join(__dirname, "../../../data/course-competencies.json");

function read()      { return fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, "utf8")) : []; }
function write(data) { fs.writeFileSync(FILE, JSON.stringify(data, null, 2)); }
function genId() {
  try { return require("crypto").randomUUID(); }
  catch { return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`; }
}

// Records which global competencies a course has been tagged with — a course never
// owns/authors competencies, it just links to entries from the shared catalog.
const CourseCompetencyLinkModel = {
  findByCourseId(courseId) {
    return read().filter((l) => l.courseId === courseId);
  },

  link(courseId, competencyId) {
    const all = read();
    const existing = all.find((l) => l.courseId === courseId && l.competencyId === competencyId);
    if (existing) return existing;
    const item = { id: genId(), courseId, competencyId, createdAt: new Date().toISOString() };
    all.push(item);
    write(all);
    return item;
  },

  unlink(courseId, competencyId) {
    const all      = read();
    const filtered = all.filter((l) => !(l.courseId === courseId && l.competencyId === competencyId));
    if (filtered.length === all.length) return false;
    write(filtered);
    return true;
  },

  deleteByCourseId(courseId) {
    const all      = read();
    const filtered = all.filter((l) => l.courseId !== courseId);
    write(filtered);
  },

  deleteByCompetencyId(competencyId) {
    const all      = read();
    const filtered = all.filter((l) => l.competencyId !== competencyId);
    write(filtered);
  },
};

module.exports = CourseCompetencyLinkModel;
