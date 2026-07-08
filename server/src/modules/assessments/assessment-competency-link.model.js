const fs   = require("fs");
const path = require("path");

const FILE = path.join(__dirname, "../../../data/assessment-competencies.json");

function read()      { return fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, "utf8")) : []; }
function write(data) { fs.writeFileSync(FILE, JSON.stringify(data, null, 2)); }
function genId() {
  try { return require("crypto").randomUUID(); }
  catch { return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`; }
}

// Records which global competencies an assessment has been tagged with — an assessment
// never owns/authors competencies, it just links to entries from the shared catalog.
const AssessmentCompetencyLinkModel = {
  findByAssessmentId(assessmentId) {
    return read().filter((l) => l.assessmentId === assessmentId);
  },

  link(assessmentId, competencyId) {
    const all = read();
    const existing = all.find((l) => l.assessmentId === assessmentId && l.competencyId === competencyId);
    if (existing) return existing;
    const item = { id: genId(), assessmentId, competencyId, createdAt: new Date().toISOString() };
    all.push(item);
    write(all);
    return item;
  },

  unlink(assessmentId, competencyId) {
    const all      = read();
    const filtered = all.filter((l) => !(l.assessmentId === assessmentId && l.competencyId === competencyId));
    if (filtered.length === all.length) return false;
    write(filtered);
    return true;
  },

  deleteByAssessmentId(assessmentId) {
    const all      = read();
    const filtered = all.filter((l) => l.assessmentId !== assessmentId);
    write(filtered);
  },

  deleteByCompetencyId(competencyId) {
    const all      = read();
    const filtered = all.filter((l) => l.competencyId !== competencyId);
    write(filtered);
  },
};

module.exports = AssessmentCompetencyLinkModel;
