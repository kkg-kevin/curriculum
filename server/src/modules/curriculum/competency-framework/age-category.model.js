const fs   = require("fs");
const path = require("path");

const FILE = path.join(__dirname, "../../../../data/age-categories.json");

function read()      { return fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, "utf8")) : []; }
function write(data) { fs.writeFileSync(FILE, JSON.stringify(data, null, 2)); }
function genId() {
  try { return require("crypto").randomUUID(); }
  catch { return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`; }
}

const AgeCategoryModel = {
  findByCurriculumId(curriculumId) {
    return read()
      .filter((c) => c.curriculumId === curriculumId)
      .sort((a, b) => a.order - b.order);
  },

  findById(id) {
    return read().find((c) => c.id === id) || null;
  },

  create(data) {
    const all    = read();
    const forCurriculum = all.filter((c) => c.curriculumId === data.curriculumId);
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
    const idx = all.findIndex((c) => c.id === id);
    if (idx === -1) return null;
    all[idx] = { ...all[idx], ...data, id, updatedAt: new Date().toISOString() };
    write(all);
    return all[idx];
  },

  delete(id) {
    const all      = read();
    const filtered = all.filter((c) => c.id !== id);
    if (filtered.length === all.length) return false;
    write(filtered);
    return true;
  },

  deleteByCurriculumId(curriculumId) {
    const all      = read();
    const filtered = all.filter((c) => c.curriculumId !== curriculumId);
    write(filtered);
  },
};

module.exports = AgeCategoryModel;
