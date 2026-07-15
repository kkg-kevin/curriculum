const fs   = require("fs");
const path = require("path");

const FILE = path.join(__dirname, "../../../../data/evidence-types.json");

function read()      { return fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, "utf8")) : []; }
function write(data) { fs.writeFileSync(FILE, JSON.stringify(data, null, 2)); }
function genId() {
  try { return require("crypto").randomUUID(); }
  catch { return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`; }
}

const EvidenceTypeModel = {
  findByCurriculumId(curriculumId) {
    return read()
      .filter((e) => e.curriculumId === curriculumId)
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  },

  findById(id) {
    return read().find((e) => e.id === id) || null;
  },

  create(data) {
    const all = read();
    const now = new Date().toISOString();
    const item = { id: genId(), ...data, createdAt: now, updatedAt: now };
    all.push(item);
    write(all);
    return item;
  },

  update(id, data) {
    const all = read();
    const idx = all.findIndex((e) => e.id === id);
    if (idx === -1) return null;
    all[idx] = { ...all[idx], ...data, id, updatedAt: new Date().toISOString() };
    write(all);
    return all[idx];
  },

  delete(id) {
    const all      = read();
    const filtered = all.filter((e) => e.id !== id);
    if (filtered.length === all.length) return false;
    write(filtered);
    return true;
  },

  deleteByCurriculumId(curriculumId) {
    const all      = read();
    const filtered = all.filter((e) => e.curriculumId !== curriculumId);
    write(filtered);
  },
};

module.exports = EvidenceTypeModel;
