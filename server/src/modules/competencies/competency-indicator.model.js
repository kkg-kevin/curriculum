const fs   = require("fs");
const path = require("path");

const FILE = path.join(__dirname, "../../../data/competency-indicators.json");

function read()      { return JSON.parse(fs.readFileSync(FILE, "utf8")); }
function write(data) { fs.writeFileSync(FILE, JSON.stringify(data, null, 2)); }
function genId() {
  try { return require("crypto").randomUUID(); }
  catch { return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`; }
}

const CompetencyIndicatorModel = {
  findByCompetencyId(competencyId) {
    return read().filter((i) => i.competencyId === competencyId);
  },

  findById(id) {
    return read().find((i) => i.id === id) || null;
  },

  create(data) {
    const all  = read();
    const now  = new Date().toISOString();
    const item = { id: genId(), ...data, createdAt: now, updatedAt: now };
    all.push(item);
    write(all);
    return item;
  },

  update(id, data) {
    const all = read();
    const idx = all.findIndex((i) => i.id === id);
    if (idx === -1) return null;
    all[idx] = { ...all[idx], ...data, id, updatedAt: new Date().toISOString() };
    write(all);
    return all[idx];
  },

  delete(id) {
    const all      = read();
    const filtered = all.filter((i) => i.id !== id);
    if (filtered.length === all.length) return false;
    write(filtered);
    return true;
  },

  deleteByCompetencyId(competencyId) {
    const all      = read();
    const filtered = all.filter((i) => i.competencyId !== competencyId);
    write(filtered);
  },
};

module.exports = CompetencyIndicatorModel;
