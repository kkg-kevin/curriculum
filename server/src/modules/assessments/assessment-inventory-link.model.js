const db = require("../../config/db");
const { generateId } = require("../../shared/utils/model.utils");

const TABLE = "assessment_inventory_links";

// Records how many units of a global inventory item a project assessment needs — an
// assessment never owns/authors inventory, it just links to entries from the shared
// catalog with a per-assessment quantity attached to the link itself.
const AssessmentInventoryLinkModel = {
  findByAssessmentId(assessmentId) {
    return db(TABLE).where({ assessmentId });
  },

  // Upsert — re-linking an already-linked item just overwrites its quantity.
  async link(assessmentId, inventoryItemId, quantity) {
    const count = await db(TABLE).where({ assessmentId, inventoryItemId }).update({ quantity });
    if (count > 0) return db(TABLE).where({ assessmentId, inventoryItemId }).first();
    const item = { id: generateId(), assessmentId, inventoryItemId, quantity, createdAt: new Date() };
    await db(TABLE).insert(item);
    return item;
  },

  async unlink(assessmentId, inventoryItemId) {
    const count = await db(TABLE).where({ assessmentId, inventoryItemId }).del();
    return count > 0;
  },

  deleteByAssessmentId(assessmentId) {
    return db(TABLE).where({ assessmentId }).del();
  },

  deleteByInventoryItemId(inventoryItemId) {
    return db(TABLE).where({ inventoryItemId }).del();
  },
};

module.exports = AssessmentInventoryLinkModel;
