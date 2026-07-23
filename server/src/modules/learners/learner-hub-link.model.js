const fs   = require("fs");
const path = require("path");

const FILE = path.join(__dirname, "../../../data/learner-hub-links.json");

function read()      { return fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, "utf8")) : []; }
function write(data) { fs.writeFileSync(FILE, JSON.stringify(data, null, 2)); }
function genId() {
  try { return require("crypto").randomUUID(); }
  catch { return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`; }
}

// Records which learning hub(s) a learner is enrolled at — a learner stays one independent
// identity/record (name, guardian, gender), it just gets linked to whichever hub(s) it's
// enrolled at, same many-to-many pattern as teacher-hub-link.model.js. Unlike the teacher
// link (which is a bare {teacherId, hubId} pair), a learner's enrollment also carries which
// class within that hub, a hub-scoped admission number, and its own enrollment status —
// distinct from the teacher case because a learner can only ever be "in" one class at a time
// within a given hub, and that placement + admission number are hub-specific facts.
const LearnerHubLinkModel = {
  findAll() {
    return read();
  },

  findByLearnerId(learnerId) {
    return read().filter((l) => l.learnerId === learnerId);
  },

  findByHubId(hubId) {
    return read().filter((l) => l.hubId === hubId);
  },

  findByClassId(classId) {
    return read().filter((l) => l.classId === classId);
  },

  findOne(learnerId, hubId) {
    return read().find((l) => l.learnerId === learnerId && l.hubId === hubId) || null;
  },

  countByAdmissionPrefix(prefix) {
    return read().filter((l) => l.admissionNumber && l.admissionNumber.startsWith(prefix)).length;
  },

  // Idempotent like teacher-hub-link's `link` — if this learner already has an enrollment at
  // this hub, returns the existing row untouched rather than creating a duplicate (use
  // `update` to change its class/status/admissionNumber instead).
  create({ learnerId, hubId, classId, admissionNumber, status }) {
    const all = read();
    const existing = all.find((l) => l.learnerId === learnerId && l.hubId === hubId);
    if (existing) return existing;
    const item = {
      id: genId(), learnerId, hubId,
      classId: classId || "", admissionNumber: admissionNumber || "", status: status || "active",
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
    all.push(item);
    write(all);
    return item;
  },

  update(id, data) {
    const all = read();
    const index = all.findIndex((l) => l.id === id);
    if (index === -1) return null;
    const patch = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined));
    all[index] = { ...all[index], ...patch, id, updatedAt: new Date().toISOString() };
    write(all);
    return all[index];
  },

  unlink(learnerId, hubId) {
    const all      = read();
    const filtered = all.filter((l) => !(l.learnerId === learnerId && l.hubId === hubId));
    if (filtered.length === all.length) return false;
    write(filtered);
    return true;
  },

  deleteByLearnerId(learnerId) {
    const all      = read();
    const filtered = all.filter((l) => l.learnerId !== learnerId);
    write(filtered);
  },

  deleteByHubId(hubId) {
    const all      = read();
    const filtered = all.filter((l) => l.hubId !== hubId);
    write(filtered);
  },

  // A class was deleted — the learner stays enrolled at the hub, just no longer placed in a
  // class there, mirroring the "unassigned" state the rest of the app already understands.
  clearClassId(classId) {
    const all = read();
    let changed = false;
    const next = all.map((l) => {
      if (l.classId !== classId) return l;
      changed = true;
      return { ...l, classId: "", updatedAt: new Date().toISOString() };
    });
    if (changed) write(next);
  },
};

module.exports = LearnerHubLinkModel;
