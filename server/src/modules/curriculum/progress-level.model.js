const fs   = require("fs");
const path = require("path");

const FILE = path.join(__dirname, "../../../data/progress-levels.json");

function read()      { return JSON.parse(fs.readFileSync(FILE, "utf8")); }
function write(data) { fs.writeFileSync(FILE, JSON.stringify(data, null, 2)); }
function genId() {
  try { return require("crypto").randomUUID(); }
  catch { return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`; }
}

const ProgressLevelModel = {
  findByCurriculumId(curriculumId) {
    return read()
      .filter((l) => l.curriculumId === curriculumId)
      .sort((a, b) => a.order - b.order);
  },

  findById(id) {
    return read().find((l) => l.id === id) || null;
  },

  create(data) {
    const all    = read();
    const forCurriculum = all.filter((l) => l.curriculumId === data.curriculumId);
    const now    = new Date().toISOString();
    const item   = {
      id: genId(),
      ...data,
      order: forCurriculum.length + 1,
      createdAt: now,
      updatedAt: now,
    };
    all.push(item);
    write(all);
    return item;
  },

  update(id, data) {
    const all = read();
    const idx = all.findIndex((l) => l.id === id);
    if (idx === -1) return null;
    all[idx] = { ...all[idx], ...data, id, updatedAt: new Date().toISOString() };
    write(all);
    return all[idx];
  },

  delete(id) {
    const all      = read();
    const filtered = all.filter((l) => l.id !== id);
    if (filtered.length === all.length) return false;
    write(filtered);
    return true;
  },
};

module.exports = ProgressLevelModel;
