const fs   = require("fs");
const path = require("path");

const FILE = path.join(__dirname, "../../../../data/curriculum-competencies.json");

function read()      { return fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, "utf8")) : []; }
function write(data) { fs.writeFileSync(FILE, JSON.stringify(data, null, 2)); }
function genId() {
  try { return require("crypto").randomUUID(); }
  catch { return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`; }
}

// Records which global competencies a curriculum has adopted — a curriculum no longer
// owns/authors competencies, it just links to entries from the shared catalog.
const CurriculumCompetencyLinkModel = {
  findByCurriculumId(curriculumId) {
    return read().filter((l) => l.curriculumId === curriculumId);
  },

  findOne(curriculumId, competencyId) {
    return read().find((l) => l.curriculumId === curriculumId && l.competencyId === competencyId) || null;
  },

  link(curriculumId, competencyId) {
    const all = read();
    const existing = all.find((l) => l.curriculumId === curriculumId && l.competencyId === competencyId);
    if (existing) return existing;
    const item = {
      id: genId(), curriculumId, competencyId,
      minimumThreshold: 60, weight: 0,
      createdAt: new Date().toISOString(),
    };
    all.push(item);
    write(all);
    return item;
  },

  // Threshold/weight are how THIS curriculum evaluates the competency — not a
  // property of the global competency, so they live on the adoption link.
  updateLink(curriculumId, competencyId, data) {
    const all = read();
    const idx = all.findIndex((l) => l.curriculumId === curriculumId && l.competencyId === competencyId);
    if (idx === -1) return null;
    all[idx] = { ...all[idx], ...data };
    write(all);
    return all[idx];
  },

  unlink(curriculumId, competencyId) {
    const all      = read();
    const filtered = all.filter((l) => !(l.curriculumId === curriculumId && l.competencyId === competencyId));
    if (filtered.length === all.length) return false;
    write(filtered);
    return true;
  },

  deleteByCurriculumId(curriculumId) {
    const all      = read();
    const filtered = all.filter((l) => l.curriculumId !== curriculumId);
    write(filtered);
  },

  deleteByCompetencyId(competencyId) {
    const all      = read();
    const filtered = all.filter((l) => l.competencyId !== competencyId);
    write(filtered);
  },
};

module.exports = CurriculumCompetencyLinkModel;
