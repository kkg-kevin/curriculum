const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

// Canonical shape (enforced at write time by course.validation.js's createCourseSchema, not
// here — same posture as every other model in this codebase): id, name, code, status,
// description, coverImage, ageMin, ageMax, requirements[], createdAt, updatedAt.
// Read directly (no accessor, no optional chaining needed beyond a null findById check) by
// timetable.service.js, reports/report.service.js, and curriculum/versions/curriculum-versions
// .service.js — a field rename here needs those three call sites updated too; nothing will
// throw if you miss one, it'll just render blank.
const FILE = path.join(__dirname, "../../../data/courses.json");

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

const CourseModel = {
  create(data) {
    const all = readAll();
    const course = {
      ...data,
      id: generateId(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    all.push(course);
    writeAll(all);
    return course;
  },

  findAll() {
    return readAll().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },

  findById(id) {
    return readAll().find((c) => c.id === id) || null;
  },

  update(id, data) {
    const all = readAll();
    const index = all.findIndex((c) => c.id === id);
    if (index === -1) return null;
    const patch = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined));
    all[index] = { ...all[index], ...patch, id, updatedAt: new Date().toISOString() };
    writeAll(all);
    return all[index];
  },

  delete(id) {
    const all = readAll();
    const index = all.findIndex((c) => c.id === id);
    if (index === -1) return false;
    all.splice(index, 1);
    writeAll(all);
    return true;
  },
};

module.exports = CourseModel;
