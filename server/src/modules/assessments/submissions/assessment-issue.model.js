const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const FILE = path.join(__dirname, "../../../../data/assessment-issues.json");

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

// One record per "a teacher released this assessment to a specific class" — deliberately
// separate from a session's assessmentAttachments (which just means "this assessment was
// authored into this session's content"). Attaching happens while a course is being built and
// says nothing about whether any learner should see it yet; issuing is the teacher's explicit
// "this is live for my class now" action. A learner only ever sees an assessment via an Issue.
const AssessmentIssueModel = {
  create(data) {
    const all = readAll();
    const record = {
      ...data,
      id: generateId(),
      issuedAt: new Date().toISOString(),
    };
    all.push(record);
    writeAll(all);
    return record;
  },

  findAll({ assessmentId, sessionId, courseId, classId, issuedBy } = {}) {
    let all = readAll();
    if (assessmentId) all = all.filter((r) => r.assessmentId === assessmentId);
    if (sessionId)    all = all.filter((r) => r.sessionId === sessionId);
    if (courseId)     all = all.filter((r) => r.courseId === courseId);
    if (classId)      all = all.filter((r) => r.classId === classId);
    if (issuedBy)     all = all.filter((r) => r.issuedBy === issuedBy);
    return all.sort((a, b) => new Date(b.issuedAt) - new Date(a.issuedAt));
  },

  findById(id) {
    return readAll().find((r) => r.id === id) || null;
  },

  findOne({ assessmentId, sessionId, classId }) {
    return readAll().find((r) => r.assessmentId === assessmentId && r.sessionId === sessionId && r.classId === classId) || null;
  },

  update(id, data) {
    const all = readAll();
    const idx = all.findIndex((r) => r.id === id);
    if (idx === -1) return null;
    const patch = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined));
    all[idx] = { ...all[idx], ...patch, id };
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

module.exports = AssessmentIssueModel;
