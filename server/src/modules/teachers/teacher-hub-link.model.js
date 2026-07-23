const fs   = require("fs");
const path = require("path");

const FILE = path.join(__dirname, "../../../data/teacher-hub-links.json");

function read()      { return fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, "utf8")) : []; }
function write(data) { fs.writeFileSync(FILE, JSON.stringify(data, null, 2)); }
function genId() {
  try { return require("crypto").randomUUID(); }
  catch { return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`; }
}

// Records which learning hubs a teacher is assigned to teach at — a teacher stays one
// independent identity/record, it just gets linked to whichever hub(s) it teaches at,
// same pattern as course-curriculum-link.model.js.
const TeacherHubLinkModel = {
  findByTeacherId(teacherId) {
    return read().filter((l) => l.teacherId === teacherId);
  },

  findByHubId(hubId) {
    return read().filter((l) => l.hubId === hubId);
  },

  link(teacherId, hubId) {
    const all = read();
    const existing = all.find((l) => l.teacherId === teacherId && l.hubId === hubId);
    if (existing) return existing;
    const item = { id: genId(), teacherId, hubId, createdAt: new Date().toISOString() };
    all.push(item);
    write(all);
    return item;
  },

  unlink(teacherId, hubId) {
    const all      = read();
    const filtered = all.filter((l) => !(l.teacherId === teacherId && l.hubId === hubId));
    if (filtered.length === all.length) return false;
    write(filtered);
    return true;
  },

  deleteByTeacherId(teacherId) {
    const all      = read();
    const filtered = all.filter((l) => l.teacherId !== teacherId);
    write(filtered);
  },

  deleteByHubId(hubId) {
    const all      = read();
    const filtered = all.filter((l) => l.hubId !== hubId);
    write(filtered);
  },
};

module.exports = TeacherHubLinkModel;
