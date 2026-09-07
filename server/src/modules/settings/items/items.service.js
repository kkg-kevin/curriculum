const ItemsModel = require("./items.model");

function conflict(message) { const err = new Error(message); err.statusCode = 409; return err; }
function notFound(message) { const err = new Error(message); err.statusCode = 404; return err; }

const ItemsService = {
  async getItems(ownerAdminId) {
    return ItemsModel.findAll({ ownerAdminId });
  },

  async createItem(data) {
    const existing = await ItemsModel.findAll({ ownerAdminId: data.ownerAdminId });
    if (existing.some((i) => i.name.toLowerCase() === data.name.toLowerCase())) {
      throw conflict("An item with this name already exists");
    }
    return ItemsModel.create(data);
  },

  async updateItem(id, data, ownerAdminId) {
    const item = await ItemsModel.findById(id);
    if (!item) throw notFound("Item not found");
    if (item.ownerAdminId !== ownerAdminId) {
      const err = new Error("You do not have permission to access this record");
      err.statusCode = 403;
      throw err;
    }
    if (data.name) {
      const all = await ItemsModel.findAll({ ownerAdminId });
      if (all.some((i) => i.id !== id && i.name.toLowerCase() === data.name.toLowerCase())) {
        throw conflict("An item with this name already exists");
      }
    }
    return ItemsModel.update(id, data);
  },

  async deleteItem(id, ownerAdminId) {
    const item = await ItemsModel.findById(id);
    if (!item) throw notFound("Item not found");
    if (item.ownerAdminId !== ownerAdminId) {
      const err = new Error("You do not have permission to access this record");
      err.statusCode = 403;
      throw err;
    }
    // Invoices only ever copy an item's name/price at the moment it's picked (see BillingPage's
    // item picker) — no invoice row references this catalog by id, so there's nothing to clean
    // up elsewhere, unlike Inventory's delete which has to unlink Courses/Assessments.
    await ItemsModel.delete(id);
  },
};

module.exports = ItemsService;
