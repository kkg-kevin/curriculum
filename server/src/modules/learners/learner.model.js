const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const FILE = path.join(__dirname, "../../../data/learners.json");

const generateId = () =>
  typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

const readAll = () => {
  if (!fs.existsSync(FILE)) return [];
  const raw = fs.readFileSync(FILE, "utf-8").trim();
  return raw ? JSON.parse(raw) : [];
};

const writeAll = (data) =>
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2), "utf-8");

const LearnerModel = {
  create(data) {
    const all = readAll();
    const record = {
      ...data,
      id: generateId(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    all.push(record);
    writeAll(all);
    return record;
  },

  findAll({ schoolId, classId, status, guardianEmail } = {}) {
    let all = readAll();
    if (schoolId)      all = all.filter((l) => l.schoolId === schoolId);
    if (classId)       all = all.filter((l) => l.classId === classId);
    if (status)        all = all.filter((l) => l.status === status);
    if (guardianEmail) all = all.filter((l) => l.guardianEmail?.toLowerCase() === guardianEmail.toLowerCase());
    return all.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },

  findById(id) {
    return readAll().find((l) => l.id === id) || null;
  },

  countByPrefix(prefix) {
    return readAll().filter((l) => l.admissionNumber && l.admissionNumber.startsWith(prefix)).length;
  },

  update(id, data) {
    const all = readAll();
    const idx = all.findIndex((l) => l.id === id);
    if (idx === -1) return null;
    const patch = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined));
    all[idx] = { ...all[idx], ...patch, id, updatedAt: new Date().toISOString() };
    writeAll(all);
    return all[idx];
  },

  delete(id) {
    const all = readAll();
    const idx = all.findIndex((l) => l.id === id);
    if (idx === -1) return false;
    all.splice(idx, 1);
    writeAll(all);
    return true;
  },
};

module.exports = LearnerModel;
