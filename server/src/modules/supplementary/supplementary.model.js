const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const FILE = path.join(__dirname, "../../../data/supplementary.json");

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

const SupplementaryModel = {
  create(data) {
    const all = readAll();
    const record = {
      ...data,
      id: generateId(),
      grades: data.grades || [],
      mapping: {},
      assignments: [{ schoolId: data.schoolId, schoolName: data.schoolName }],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    all.push(record);
    writeAll(all);
    return record;
  },

  findAll({ schoolId, type } = {}) {
    let all = readAll();
    if (schoolId) {
      // include records where this school is the origin OR appears in assignments
      all = all.filter((s) =>
        s.schoolId === schoolId ||
        (s.assignments || []).some((a) => a.schoolId === schoolId)
      );
    }
    if (type) all = all.filter((s) => s.type === type);
    return all.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },

  findById(id) {
    return readAll().find((s) => s.id === id) || null;
  },

  update(id, data) {
    const all = readAll();
    const index = all.findIndex((s) => s.id === id);
    if (index === -1) return null;
    const patch = Object.fromEntries(
      Object.entries(data).filter(([, v]) => v !== undefined)
    );
    all[index] = { ...all[index], ...patch, id, updatedAt: new Date().toISOString() };
    writeAll(all);
    return all[index];
  },

  delete(id) {
    const all = readAll();
    const index = all.findIndex((s) => s.id === id);
    if (index === -1) return false;
    all.splice(index, 1);
    writeAll(all);
    return true;
  },
};

module.exports = SupplementaryModel;
