const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const FILE = path.join(__dirname, "../../../../data/academic-year-groups.json");

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

const AcademicYearGroupModel = {
  findByCurriculumId(curriculumId) {
    return readAll().filter((g) => g.curriculumId === curriculumId);
  },

  findById(id) {
    return readAll().find((g) => g.id === id) || null;
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
    const idx = all.findIndex((g) => g.id === id);
    if (idx === -1) return null;
    all[idx] = { ...all[idx], ...changes, updatedAt: new Date().toISOString() };
    writeAll(all);
    return all[idx];
  },
};

module.exports = AcademicYearGroupModel;
