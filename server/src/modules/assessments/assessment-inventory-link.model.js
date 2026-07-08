const fs   = require("fs");
const path = require("path");

const FILE = path.join(__dirname, "../../../data/assessment-inventory-links.json");

function read()      { return fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, "utf8")) : []; }
function write(data) { fs.writeFileSync(FILE, JSON.stringify(data, null, 2)); }
function genId() {
  try { return require("crypto").randomUUID(); }
  catch { return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`; }
}

// Records how many units of a global inventory item a project assessment needs — an
// assessment never owns/authors inventory, it just links to entries from the shared
// catalog with a per-assessment quantity attached to the link itself.
const AssessmentInventoryLinkModel = {
  findByAssessmentId(assessmentId) {
    return read().filter((l) => l.assessmentId === assessmentId);
  },

  // Upsert — re-linking an already-linked item just overwrites its quantity.
  link(assessmentId, inventoryItemId, quantity) {
    const all = read();
    const idx = all.findIndex((l) => l.assessmentId === assessmentId && l.inventoryItemId === inventoryItemId);
    if (idx !== -1) {
      all[idx] = { ...all[idx], quantity };
      write(all);
      return all[idx];
    }
    const item = { id: genId(), assessmentId, inventoryItemId, quantity, createdAt: new Date().toISOString() };
    all.push(item);
    write(all);
    return item;
  },

  unlink(assessmentId, inventoryItemId) {
    const all      = read();
    const filtered = all.filter((l) => !(l.assessmentId === assessmentId && l.inventoryItemId === inventoryItemId));
    if (filtered.length === all.length) return false;
    write(filtered);
    return true;
  },

  deleteByAssessmentId(assessmentId) {
    const all      = read();
    const filtered = all.filter((l) => l.assessmentId !== assessmentId);
    write(filtered);
  },

  deleteByInventoryItemId(inventoryItemId) {
    const all      = read();
    const filtered = all.filter((l) => l.inventoryItemId !== inventoryItemId);
    write(filtered);
  },
};

module.exports = AssessmentInventoryLinkModel;
