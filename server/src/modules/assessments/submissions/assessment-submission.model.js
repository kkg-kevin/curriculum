const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const FILE = path.join(__dirname, "../../../../data/assessment-submissions.json");

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

// One record per (issue, learner) — a learner's single attempt at an issued assessment.
const AssessmentSubmissionModel = {
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

  findAll({ issueId, assessmentId, learnerId, classId, status } = {}) {
    let all = readAll();
    if (issueId)      all = all.filter((r) => r.issueId === issueId);
    if (assessmentId) all = all.filter((r) => r.assessmentId === assessmentId);
    if (learnerId)    all = all.filter((r) => r.learnerId === learnerId);
    if (classId)      all = all.filter((r) => r.classId === classId);
    if (status)       all = all.filter((r) => r.status === status);
    return all.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  },

  findById(id) {
    return readAll().find((r) => r.id === id) || null;
  },

  findOne({ issueId, learnerId }) {
    return readAll().find((r) => r.issueId === issueId && r.learnerId === learnerId) || null;
  },

  update(id, data) {
    const all = readAll();
    const idx = all.findIndex((r) => r.id === id);
    if (idx === -1) return null;
    const patch = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined));
    all[idx] = { ...all[idx], ...patch, id, updatedAt: new Date().toISOString() };
    writeAll(all);
    return all[idx];
  },

  delete(id) {
    const all = readAll();
    const idx = all.findIndex((r) => r.id === id);
    if (idx === -1) return false;
    all.splice(idx, 1);
    writeAll(all);
    return true;
  },
};

module.exports = AssessmentSubmissionModel;
