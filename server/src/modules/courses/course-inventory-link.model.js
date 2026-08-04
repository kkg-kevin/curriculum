const fs   = require("fs");
const path = require("path");

const FILE = path.join(__dirname, "../../../data/course-inventory-links.json");

function read()      { return fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, "utf8")) : []; }
function write(data) { fs.writeFileSync(FILE, JSON.stringify(data, null, 2)); }
function genId() {
  try { return require("crypto").randomUUID(); }
  catch { return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`; }
}

// Records how many units of a global inventory item a course needs overall — same shape as
// assessment-inventory-link.model.js's project-assessment link, just keyed by courseId instead
// of assessmentId. A course never owns/authors inventory, it just links to entries from the
// shared catalog with a per-course quantity attached to the link itself.
const CourseInventoryLinkModel = {
  findByCourseId(courseId) {
    return read().filter((l) => l.courseId === courseId);
  },

  // Upsert — re-linking an already-linked item just overwrites its quantity.
  link(courseId, inventoryItemId, quantity) {
    const all = read();
    const idx = all.findIndex((l) => l.courseId === courseId && l.inventoryItemId === inventoryItemId);
    if (idx !== -1) {
      all[idx] = { ...all[idx], quantity };
      write(all);
      return all[idx];
    }
    const item = { id: genId(), courseId, inventoryItemId, quantity, createdAt: new Date().toISOString() };
    all.push(item);
    write(all);
    return item;
  },

  unlink(courseId, inventoryItemId) {
    const all      = read();
    const filtered = all.filter((l) => !(l.courseId === courseId && l.inventoryItemId === inventoryItemId));
    if (filtered.length === all.length) return false;
    write(filtered);
    return true;
  },

  deleteByCourseId(courseId) {
    const all      = read();
    const filtered = all.filter((l) => l.courseId !== courseId);
    write(filtered);
  },

  deleteByInventoryItemId(inventoryItemId) {
    const all      = read();
    const filtered = all.filter((l) => l.inventoryItemId !== inventoryItemId);
    write(filtered);
  },
};

module.exports = CourseInventoryLinkModel;
