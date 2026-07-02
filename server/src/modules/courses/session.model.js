const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const FILE = path.join(__dirname, "../../../data/course-sessions.json");

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

const SessionModel = {
  create(data) {
    const all = readAll();
    const session = {
      ...data,
      id: generateId(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    all.push(session);
    writeAll(all);
    return session;
  },

  findByCourseId(courseId) {
    return readAll()
      .filter((s) => s.courseId === courseId)
      .sort((a, b) => a.order - b.order);
  },

  findById(id) {
    return readAll().find((s) => s.id === id) || null;
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

  deleteByCourseId(courseId) {
    const all = readAll();
    const filtered = all.filter((s) => s.courseId !== courseId);
    writeAll(filtered);
  },
};

module.exports = SessionModel;
