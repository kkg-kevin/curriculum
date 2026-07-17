const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const FILE = path.join(__dirname, "../../../data/attendance.json");

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

const AttendanceModel = {
  findAll({ classId, learnerId, date, dateFrom, dateTo, status } = {}) {
    let all = readAll();
    if (classId)   all = all.filter((a) => a.classId === classId);
    if (learnerId) all = all.filter((a) => a.learnerId === learnerId);
    if (date)      all = all.filter((a) => a.date === date);
    if (dateFrom)  all = all.filter((a) => a.date >= dateFrom);
    if (dateTo)    all = all.filter((a) => a.date <= dateTo);
    if (status)    all = all.filter((a) => a.status === status);
    return all.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  },

  findByClassAndDate(classId, date) {
    return readAll().filter((a) => a.classId === classId && a.date === date);
  },

  findById(id) {
    return readAll().find((a) => a.id === id) || null;
  },

  // Re-marking a day is an idempotent overwrite — drop whatever was recorded for this
  // classId+date and insert the fresh set, rather than reconciling create-vs-update per learner.
  bulkMark(classId, date, records, markedBy) {
    const all = readAll().filter((a) => !(a.classId === classId && a.date === date));
    const now = new Date().toISOString();
    const created = records.map((r) => ({
      id: generateId(),
      classId,
      date,
      learnerId: r.learnerId,
      status: r.status,
      notes: r.notes || "",
      markedBy,
      createdAt: now,
      updatedAt: now,
    }));
    writeAll([...all, ...created]);
    return created;
  },
};

module.exports = AttendanceModel;
