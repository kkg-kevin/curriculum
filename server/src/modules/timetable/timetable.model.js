const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const FILE = path.join(__dirname, "../../../data/timetable-slots.json");

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

const TimetableModel = {
  findAll({ classId, teacherId, dayOfWeek } = {}) {
    let all = readAll();
    if (classId)   all = all.filter((s) => s.classId === classId);
    if (teacherId) all = all.filter((s) => s.teacherId === teacherId);
    if (dayOfWeek) all = all.filter((s) => s.dayOfWeek === dayOfWeek);
    return all.sort((a, b) => a.startTime.localeCompare(b.startTime));
  },

  findById(id) {
    return readAll().find((s) => s.id === id) || null;
  },

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

  update(id, data) {
    const all = readAll();
    const index = all.findIndex((s) => s.id === id);
    if (index === -1) return null;
    const patch = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined));
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

  // Called from class.service.js's deleteClass — a class's own timetable has no meaning once
  // the class itself is gone.
  deleteByClassId(classId) {
    const all = readAll();
    const filtered = all.filter((s) => s.classId !== classId);
    if (filtered.length !== all.length) writeAll(filtered);
    return all.length - filtered.length;
  },
};

module.exports = TimetableModel;
