const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const FILE = path.join(__dirname, "../../../data/reports.json");

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

// One record per (learner, course, class) — a teacher-published, point-in-time snapshot of that
// learner's graded assessments for the course, plus their indicator breakdown and any remarks.
// "draft" is visible only to admin/school/teacher (so a teacher can review before publishing);
// "published" additionally becomes visible to the learner/guardian.
//
// classId is part of the identity, not just a field: a learner can be enrolled at several hubs at
// once (see learner-hub-link.model.js), and two of those classes can each run the same course. On
// a (learner, course) key alone, the second teacher's "Generate" would silently overwrite the
// first teacher's report and hand back a record scoped to a class they can't even access.
const ReportModel = {
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

  findAll({ classId, courseId, learnerId, status } = {}) {
    let all = readAll();
    if (classId)   all = all.filter((r) => r.classId === classId);
    if (courseId)  all = all.filter((r) => r.courseId === courseId);
    if (learnerId) all = all.filter((r) => r.learnerId === learnerId);
    if (status)    all = all.filter((r) => r.status === status);
    return all.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  },

  // classId is required — see the identity note above. Legacy rows written before classId joined
  // the key still match here, since every report has always carried a classId field.
  findOne({ learnerId, courseId, classId }) {
    return readAll().find((r) => r.learnerId === learnerId && r.courseId === courseId && r.classId === classId) || null;
  },

  findById(id) {
    return readAll().find((r) => r.id === id) || null;
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

  // Deleting a learner has to take their reports with it — nothing else can ever reach a report
  // whose learner is gone (every read path resolves the learner first), so leaving them behind
  // just accumulates unreachable rows. Called from learner.service.js's deleteLearner.
  deleteByLearnerId(learnerId) {
    const all = readAll();
    const filtered = all.filter((r) => r.learnerId !== learnerId);
    if (filtered.length !== all.length) writeAll(filtered);
    return all.length - filtered.length;
  },
};

module.exports = ReportModel;
