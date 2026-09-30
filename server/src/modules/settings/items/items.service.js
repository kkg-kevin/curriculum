const ItemsModel = require("./items.model");
const { GOODS_ONLY_FIELDS } = require("./items.validation");
const AssessmentInventoryLinkModel = require("../../assessments/assessment-inventory-link.model");
const CourseInventoryLinkModel = require("../../courses/course-inventory-link.model");

const KIND_LABEL = { goods: "Goods", service: "Services" };

function httpError(statusCode, message) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

// A Service never carries goods-only fields (category, image, Store fields) — whatever the client
// sent for them is dropped, so a service can't end up in the Store or tagged as a material.
function withoutGoodsFields(data) {
  const out = { ...data };
  GOODS_ONLY_FIELDS.forEach((f) => { delete out[f]; });
  return out;
}

// Names are unique per admin within a kind — the rule each catalog had on its own before the
// merge. A Goods item and a Service may share a name.
async function assertNameAvailable({ ownerAdminId, kind, name, excludeId }) {
  const all = await ItemsModel.findAll({ ownerAdminId, kind });
  if (all.some((i) => i.id !== excludeId && i.name.toLowerCase() === name.toLowerCase())) {
    throw httpError(409, `An item with this name already exists in ${KIND_LABEL[kind]}`);
  }
}

// Loads an item this admin owns. `onlyKind` scopes the legacy /api/inventory routes to Goods: a
// Service is simply not found there.
async function loadOwnedItem(id, ownerAdminId, onlyKind) {
  const item = await ItemsModel.findById(id);
  if (!item || (onlyKind && item.kind !== onlyKind)) throw httpError(404, "Item not found");
  if (item.ownerAdminId !== ownerAdminId) {
    throw httpError(403, "You do not have permission to access this record");
  }
  return item;
}

const ItemsService = {
  async getItems(ownerAdminId, { kind } = {}) {
    return ItemsModel.findAll({ ownerAdminId, kind });
  },

  async createItem(data) {
    const { kind } = data;
    await assertNameAvailable({ ownerAdminId: data.ownerAdminId, kind, name: data.name });
    if (kind === "service") {
      return ItemsModel.create({
        ...withoutGoodsFields(data),
        unit: data.unit || "item",
        category: null,
        image: null,
        saleStatus: "internal",
      });
    }
    return ItemsModel.create({ ...data, unit: data.unit || "pcs" });
  },

  async updateItem(id, data, ownerAdminId, { onlyKind } = {}) {
    const item = await loadOwnedItem(id, ownerAdminId, onlyKind);
    const targetKind = data.kind || item.kind;
    let patch = { ...data };

    if (targetKind !== item.kind) {
      if (targetKind === "service") {
        // Goods → Service. A service can't be a course/project material or sit in the Store,
        // so refuse rather than silently unlinking or unlisting it.
        const uses = (await CourseInventoryLinkModel.countByInventoryItemId(id))
          + (await AssessmentInventoryLinkModel.countByInventoryItemId(id));
        if (uses > 0) {
          throw httpError(409, `"${item.name}" is a material on ${uses} course${uses === 1 ? "" : "s"}/project${uses === 1 ? "" : "s"} — remove it there before moving it to Services`);
        }
        if (item.saleStatus === "for_sale") {
          throw httpError(409, `"${item.name}" is for sale in the website Store — take it off sale before moving it to Services`);
        }
        patch = { ...withoutGoodsFields(patch), category: null, image: null, saleStatus: "internal", storeCategory: null };
      } else {
        // Service → Goods: it needs a materials category; everything else keeps its value.
        patch = { ...patch, category: patch.category || "Other" };
      }
    } else if (targetKind === "service") {
      patch = withoutGoodsFields(patch);
    }

    if (patch.name || targetKind !== item.kind) {
      await assertNameAvailable({ ownerAdminId, kind: targetKind, name: patch.name || item.name, excludeId: id });
    }
    return ItemsModel.update(id, patch);
  },

  async deleteItem(id, ownerAdminId, { onlyKind } = {}) {
    await loadOwnedItem(id, ownerAdminId, onlyKind);
    await ItemsModel.delete(id);
    // Courses and Projects reference Goods by id (never a copy), so those links must go too or
    // they'd point at a dead id. Invoices only ever copied an item's name/price, so nothing on
    // the billing side needs cleaning up.
    await AssessmentInventoryLinkModel.deleteByInventoryItemId(id);
    await CourseInventoryLinkModel.deleteByInventoryItemId(id);
  },
};

module.exports = ItemsService;
