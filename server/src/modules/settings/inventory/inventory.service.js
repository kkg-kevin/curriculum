const InventoryModel = require("./inventory.model");
const AssessmentInventoryLinkModel = require("../../assessments/assessment-inventory-link.model");

const InventoryService = {
  getInventoryItems() {
    return InventoryModel.findAll();
  },

  createInventoryItem(data) {
    const existing = InventoryModel.findAll();
    if (existing.some((i) => i.name.toLowerCase() === data.name.toLowerCase())) {
      const err = new Error("An inventory item with this name already exists");
      err.statusCode = 409;
      throw err;
    }
    return InventoryModel.create(data);
  },

  updateInventoryItem(id, data) {
    const item = InventoryModel.findById(id);
    if (!item) {
      const err = new Error("Inventory item not found");
      err.statusCode = 404;
      throw err;
    }
    if (data.name) {
      const others = InventoryModel.findAll().filter((i) => i.id !== id);
      if (others.some((i) => i.name.toLowerCase() === data.name.toLowerCase())) {
        const err = new Error("An inventory item with this name already exists");
        err.statusCode = 409;
        throw err;
      }
    }
    return InventoryModel.update(id, data);
  },

  deleteInventoryItem(id) {
    const item = InventoryModel.findById(id);
    if (!item) {
      const err = new Error("Inventory item not found");
      err.statusCode = 404;
      throw err;
    }
    InventoryModel.delete(id);
    // Projects only ever reference the catalog by id (never copy it), so those
    // references must be cleaned up here or they'd point at a dead id.
    AssessmentInventoryLinkModel.deleteByInventoryItemId(id);
  },
};

module.exports = InventoryService;
