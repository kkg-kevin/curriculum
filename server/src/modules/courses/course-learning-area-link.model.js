const fs   = require("fs");
const path = require("path");

const FILE = path.join(__dirname, "../../../data/course-learning-areas.json");

function read()      { return fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, "utf8")) : []; }
function write(data) { fs.writeFileSync(FILE, JSON.stringify(data, null, 2)); }
function genId() {
  try { return require("crypto").randomUUID(); }
  catch { return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`; }
}

// Records which global learning areas a course has been tagged with — a course never
// owns/authors learning areas, it just links to entries from the shared catalog.
const CourseLearningAreaLinkModel = {
  findByCourseId(courseId) {
    return read().filter((l) => l.courseId === courseId);
  },

  link(courseId, learningAreaId) {
    const all = read();
    const existing = all.find((l) => l.courseId === courseId && l.learningAreaId === learningAreaId);
    if (existing) return existing;
    const item = { id: genId(), courseId, learningAreaId, createdAt: new Date().toISOString() };
    all.push(item);
    write(all);
    return item;
  },

  unlink(courseId, learningAreaId) {
    const all      = read();
    const filtered = all.filter((l) => !(l.courseId === courseId && l.learningAreaId === learningAreaId));
    if (filtered.length === all.length) return false;
    write(filtered);
    return true;
  },

  deleteByCourseId(courseId) {
    const all      = read();
    const filtered = all.filter((l) => l.courseId !== courseId);
    write(filtered);
  },

  deleteByLearningAreaId(learningAreaId) {
    const all      = read();
    const filtered = all.filter((l) => l.learningAreaId !== learningAreaId);
    write(filtered);
  },
};

module.exports = CourseLearningAreaLinkModel;
