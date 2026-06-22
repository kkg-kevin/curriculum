const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const FILE = path.join(__dirname, "../../../data/curriculum-versions.json");

const generateId = () =>
  typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

const readAll = () => {
  if (!fs.existsSync(FILE)) return [];
  const raw = fs.readFileSync(FILE, "utf-8").trim();
  return raw ? JSON.parse(raw) : [];
};

const writeAll = (data) => {
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2), "utf-8");
};

const CurriculumVersionModel = {
  create(data) {
    const all = readAll();
    const version = {
      ...data,
      id: generateId(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    all.push(version);
    writeAll(all);
    return version;
  },

  findAllByCurriculumId(curriculumId) {
    return readAll()
      .filter((v) => v.curriculumId === curriculumId)
      .sort((a, b) => b.versionNumber - a.versionNumber);
  },

  findById(id) {
    return readAll().find((v) => v.id === id) || null;
  },

  findActiveByCurriculumId(curriculumId) {
    return readAll().find(
      (v) => v.curriculumId === curriculumId && v.status === "active"
    ) || null;
  },

  countByCurriculumId(curriculumId) {
    return readAll().filter((v) => v.curriculumId === curriculumId).length;
  },

  update(id, data) {
    const all = readAll();
    const index = all.findIndex((v) => v.id === id);
    if (index === -1) return null;
    all[index] = { ...all[index], ...data, updatedAt: new Date().toISOString() };
    writeAll(all);
    return all[index];
  },

  // Bulk-update every version for a curriculum (used when archiving the active one)
  updateWhere(curriculumId, predicate, patch) {
    const all = readAll();
    let changed = false;
    all.forEach((v, i) => {
      if (v.curriculumId === curriculumId && predicate(v)) {
        all[i] = { ...all[i], ...patch, updatedAt: new Date().toISOString() };
        changed = true;
      }
    });
    if (changed) writeAll(all);
  },

  delete(id) {
    const all = readAll();
    const index = all.findIndex((v) => v.id === id);
    if (index === -1) return false;
    all.splice(index, 1);
    writeAll(all);
    return true;
  },

  deleteByCurriculumId(curriculumId) {
    const all = readAll().filter((v) => v.curriculumId !== curriculumId);
    writeAll(all);
  },
};

module.exports = CurriculumVersionModel;
