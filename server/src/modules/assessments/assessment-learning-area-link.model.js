const fs   = require("fs");
const path = require("path");

const FILE = path.join(__dirname, "../../../data/assessment-learning-areas.json");

function read()      { return fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, "utf8")) : []; }
function write(data) { fs.writeFileSync(FILE, JSON.stringify(data, null, 2)); }
function genId() {
  try { return require("crypto").randomUUID(); }
  catch { return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`; }
}

// Records which global learning areas an assessment has been tagged with — an assessment
// never owns/authors learning areas, it just links to entries from the shared catalog.
const AssessmentLearningAreaLinkModel = {
  findByAssessmentId(assessmentId) {
    return read().filter((l) => l.assessmentId === assessmentId);
  },

  link(assessmentId, learningAreaId) {
    const all = read();
    const existing = all.find((l) => l.assessmentId === assessmentId && l.learningAreaId === learningAreaId);
    if (existing) return existing;
    const item = { id: genId(), assessmentId, learningAreaId, createdAt: new Date().toISOString() };
    all.push(item);
    write(all);
    return item;
  },

  unlink(assessmentId, learningAreaId) {
    const all      = read();
    const filtered = all.filter((l) => !(l.assessmentId === assessmentId && l.learningAreaId === learningAreaId));
    if (filtered.length === all.length) return false;
    write(filtered);
    return true;
  },

  deleteByAssessmentId(assessmentId) {
    const all      = read();
    const filtered = all.filter((l) => l.assessmentId !== assessmentId);
    write(filtered);
  },

  deleteByLearningAreaId(learningAreaId) {
    const all      = read();
    const filtered = all.filter((l) => l.learningAreaId !== learningAreaId);
    write(filtered);
  },
};

module.exports = AssessmentLearningAreaLinkModel;
