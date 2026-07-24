const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const FILE = path.join(__dirname, "../../../data/programs.json");

const generateId = () =>
  typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

const readAll = () => {
  if (!fs.existsSync(FILE)) return [];
  const raw = fs.readFileSync(FILE, "utf-8").trim();
  return raw ? JSON.parse(raw) : [];
};

const writeAll = (data) => fs.writeFileSync(FILE, JSON.stringify(data, null, 2), "utf-8");

const ProgramModel = {
  create(data) {
    const all = readAll();
    const record = { ...data, id: generateId(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    all.push(record);
    writeAll(all);
    return record;
  },

  findAll({ curriculumId } = {}) {
    let all = readAll();
    if (curriculumId) all = all.filter((p) => p.curriculumId === curriculumId);
    return all.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },

  findById(id) {
    return readAll().find((p) => p.id === id) || null;
  },

  update(id, data) {
    const all = readAll();
    const idx = all.findIndex((p) => p.id === id);
    if (idx === -1) return null;
    const patch = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined));
    all[idx] = { ...all[idx], ...patch, id, updatedAt: new Date().toISOString() };
    writeAll(all);
    return all[idx];
  },

  // Deliberately doesn't touch the underlying Class or Curriculum — a program's cohort/history
  // shouldn't vanish just because the program record itself is removed. Same caution as
  // learner/teacher deletion elsewhere in this codebase.
  delete(id) {
    const all = readAll();
    const idx = all.findIndex((p) => p.id === id);
    if (idx === -1) return false;
    all.splice(idx, 1);
    writeAll(all);
    return true;
  },
};

module.exports = ProgramModel;
