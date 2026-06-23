const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const FILE = path.join(__dirname, "../../../data/academic-years.json");

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

const AcademicYearModel = {
  findByCurriculumId(curriculumId) {
    return readAll().filter((y) => y.curriculumId === curriculumId);
  },

  findCurrent(curriculumId) {
    return readAll().find((y) => y.curriculumId === curriculumId && y.isCurrent) || null;
  },

  findById(id) {
    return readAll().find((y) => y.id === id) || null;
  },

  create(data) {
    const all = readAll();
    const record = { id: genId(), ...data, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    writeAll([...all, record]);
    return record;
  },

  update(id, changes) {
    const all = readAll();
    const idx = all.findIndex((y) => y.id === id);
    if (idx === -1) return null;
    all[idx] = { ...all[idx], ...changes, updatedAt: new Date().toISOString() };
    writeAll(all);
    return all[idx];
  },

  setAllNotCurrent(curriculumId) {
    const all = readAll();
    writeAll(all.map((y) => (y.curriculumId === curriculumId ? { ...y, isCurrent: false } : y)));
  },

  deactivateAllActive(curriculumId) {
    const all = readAll();
    writeAll(
      all.map((y) =>
        y.curriculumId === curriculumId && y.status === "active"
          ? { ...y, status: "inactive", updatedAt: new Date().toISOString() }
          : y
      )
    );
  },
};

module.exports = AcademicYearModel;
