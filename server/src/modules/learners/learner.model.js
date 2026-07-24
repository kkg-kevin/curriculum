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

  // schoolId/classId/status/admissionNumber no longer live on the learner record — they're
  // per-enrollment facts on learner-hub-link.model.js. `ids` lets a caller pre-resolve "which
  // learners have a link matching X" via that table and filter down to just those (same
  // pattern as teacher.model.js's `ids` filter, fed by teacher-hub-link lookups).
  findAll({ ids, guardianEmail } = {}) {
    let all = readAll();
    if (ids)           all = all.filter((l) => ids.includes(l.id));
    if (guardianEmail) all = all.filter((l) => l.guardianEmail?.toLowerCase() === guardianEmail.toLowerCase());
    return all.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },

  // Used both for uniqueness checks (learner.service.js) and to resolve a username-based
  // login (auth.service.js) back to the learner whose guardian account it should sign into.
  findByUsername(username) {
    if (!username) return null;
    return readAll().find((l) => l.username?.toLowerCase() === username.toLowerCase()) || null;
  },

  findById(id) {
    return readAll().find((l) => l.id === id) || null;
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
