const InventoryModel = require("./inventory.model");
const AssessmentInventoryLinkModel = require("../../assessments/assessment-inventory-link.model");
const CourseInventoryLinkModel = require("../../courses/course-inventory-link.model");

const InventoryService = {
  async getInventoryItems() {
    return InventoryModel.findAll();
  },

  async createInventoryItem(data) {
    const existing = await InventoryModel.findAll();
    if (existing.some((i) => i.name.toLowerCase() === data.name.toLowerCase())) {
      const err = new Error("An inventory item with this name already exists");
      err.statusCode = 409;
      throw err;
    }
    return InventoryModel.create(data);
  },

  async updateInventoryItem(id, data) {
    const item = await InventoryModel.findById(id);
    if (!item) {
      const err = new Error("Inventory item not found");
      err.statusCode = 404;
      throw err;
    }
    if (data.name) {
      const all = await InventoryModel.findAll();
      const others = all.filter((i) => i.id !== id);
      if (others.some((i) => i.name.toLowerCase() === data.name.toLowerCase())) {
        const err = new Error("An inventory item with this name already exists");
        err.statusCode = 409;
        throw err;
      }
    }
    return InventoryModel.update(id, data);
  },

  async deleteInventoryItem(id) {
    const item = await InventoryModel.findById(id);
    if (!item) {
      const err = new Error("Inventory item not found");
      err.statusCode = 404;
      throw err;
    }
    await InventoryModel.delete(id);
    // Projects and courses only ever reference the catalog by id (never copy it), so those
    // references must be cleaned up here or they'd point at a dead id.
    await AssessmentInventoryLinkModel.deleteByInventoryItemId(id);
    await CourseInventoryLinkModel.deleteByInventoryItemId(id);
  },
};

module.exports = InventoryService;
