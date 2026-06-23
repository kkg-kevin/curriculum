const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const FILE = path.join(__dirname, "../../../data/academic-year-versions.json");

const genId = () =>
  typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

const readAll = () => {
  if (!fs.existsSync(FILE)) return [];
  const raw = fs.readFileSync(FILE, "utf-8").trim();
  return raw ? JSON.parse(raw) : [];
};

const writeAll = (data) => fs.writeFileSync(FILE, JSON.stringify(data, null, 2), "utf-8");

const AcademicYearVersionModel = {
  findByGroupId(yearGroupId) {
    return readAll().filter((v) => v.yearGroupId === yearGroupId);
  },

  findByCurriculumId(curriculumId) {
    return readAll().filter((v) => v.curriculumId === curriculumId);
  },

  findById(id) {
    return readAll().find((v) => v.id === id) || null;
  },

  findPublished(curriculumId) {
    return readAll().find((v) => v.curriculumId === curriculumId && v.status === "published") || null;
  },

  create(data) {
    const all = readAll();
    const record = {
      id: genId(),
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    writeAll([...all, record]);
    return record;
  },

  update(id, changes) {
    const all = readAll();
    const idx = all.findIndex((v) => v.id === id);
    if (idx === -1) return null;
    all[idx] = { ...all[idx], ...changes, updatedAt: new Date().toISOString() };
    writeAll(all);
    return all[idx];
  },

  // Demote all versions in a group to isCurrent: false
  setGroupNotCurrent(yearGroupId) {
    const all = readAll();
    writeAll(
      all.map((v) =>
        v.yearGroupId === yearGroupId ? { ...v, isCurrent: false, updatedAt: new Date().toISOString() } : v
      )
    );
  },
};

module.exports = AcademicYearVersionModel;
