const fs   = require("fs");
const path = require("path");

const FILE = path.join(__dirname, "../../../../data/system-levels.json");

function read()      { return fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, "utf8")) : []; }
function write(data) { fs.writeFileSync(FILE, JSON.stringify(data, null, 2)); }
function genId() {
  try { return require("crypto").randomUUID(); }
  catch { return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`; }
}

// The fixed, cross-curriculum spine every curriculum's grades map onto (see
// Curriculum.classes[].systemLevelId) — one global list, not per-curriculum, so "Level 6"
// means the same developmental position everywhere regardless of what any one curriculum
// calls it. Always read/returned in sequence order since that order is the entire point.
const SystemLevelModel = {
  findAll() {
    return read().sort((a, b) => a.sequence - b.sequence);
  },

  findById(id) {
    return read().find((l) => l.id === id) || null;
  },

  create(data) {
    const all = read();
    const nextSequence = all.reduce((max, l) => Math.max(max, l.sequence || 0), 0) + 1;
    const now = new Date().toISOString();
    const item = { id: genId(), sequence: nextSequence, ...data, createdAt: now, updatedAt: now };
    all.push(item);
    write(all);
    return item;
  },

  update(id, data) {
    const all = read();
    const idx = all.findIndex((l) => l.id === id);
    if (idx === -1) return null;
    all[idx] = { ...all[idx], ...data, id, updatedAt: new Date().toISOString() };
    write(all);
    return all[idx];
  },

  delete(id) {
    const all      = read();
    const filtered = all.filter((l) => l.id !== id);
    if (filtered.length === all.length) return false;
    write(filtered);
    return true;
  },

  // Re-numbers sequence 1..N to match the given id order — same pattern as
  // performance-band.model.js's reorder.
  reorder(orderedIds) {
    const all = read();
    orderedIds.forEach((id, i) => {
      const idx = all.findIndex((l) => l.id === id);
      if (idx !== -1) all[idx].sequence = i + 1;
    });
    write(all);
    return all.sort((a, b) => a.sequence - b.sequence);
  },
};

module.exports = SystemLevelModel;
