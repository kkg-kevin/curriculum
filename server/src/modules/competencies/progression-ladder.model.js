const fs   = require("fs");
const path = require("path");

const FILE = path.join(__dirname, "../../../data/progression-ladder.json");

function read()      { return JSON.parse(fs.readFileSync(FILE, "utf8")); }
function write(data) { fs.writeFileSync(FILE, JSON.stringify(data, null, 2)); }
function genId() {
  try { return require("crypto").randomUUID(); }
  catch { return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`; }
}

const ProgressionLadderModel = {
  findByCurriculumId(curriculumId) {
    return read().filter((r) => r.curriculumId === curriculumId);
  },

  findById(id) {
    return read().find((r) => r.id === id) || null;
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
    const idx = all.findIndex((r) => r.id === id);
    if (idx === -1) return null;
    all[idx] = { ...all[idx], ...data, id, updatedAt: new Date().toISOString() };
    write(all);
    return all[idx];
  },

  deleteByCurriculumId(curriculumId) {
    const all      = read();
    const filtered = all.filter((r) => r.curriculumId !== curriculumId);
    write(filtered);
  },
};

module.exports = ProgressionLadderModel;
