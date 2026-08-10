const db = require("../../config/db");
const { generateId } = require("../../shared/utils/model.utils");

const TABLE = "course_inventory_links";

// Records how many units of a global inventory item a course needs overall — same shape as
// assessment-inventory-link.model.js's project-assessment link, just keyed by courseId instead
// of assessmentId. A course never owns/authors inventory, it just links to entries from the
// shared catalog with a per-course quantity attached to the link itself.
const CourseInventoryLinkModel = {
  findByCourseId(courseId) {
    return db(TABLE).where({ courseId });
  },

  // Upsert — re-linking an already-linked item just overwrites its quantity.
  async link(courseId, inventoryItemId, quantity) {
    const count = await db(TABLE).where({ courseId, inventoryItemId }).update({ quantity });
    if (count > 0) return db(TABLE).where({ courseId, inventoryItemId }).first();
    const item = { id: generateId(), courseId, inventoryItemId, quantity, createdAt: new Date() };
    await db(TABLE).insert(item);
    return item;
  },

  async unlink(courseId, inventoryItemId) {
    const count = await db(TABLE).where({ courseId, inventoryItemId }).del();
    return count > 0;
  },

  deleteByCourseId(courseId) {
    return db(TABLE).where({ courseId }).del();
  },

  deleteByInventoryItemId(inventoryItemId) {
    return db(TABLE).where({ inventoryItemId }).del();
  },
};

module.exports = CourseInventoryLinkModel;
