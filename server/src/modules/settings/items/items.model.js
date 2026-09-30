const db = require("../../../config/db");
const {
  createRecord,
  updateRecord,
  deleteRecord,
  firstOrNull,
  stringifyJsonFields,
} = require("../../../shared/utils/model.utils");

// Settings → Items: one catalog of Goods and Services (see items.validation.js). Formerly two
// tables, `inventory` (now the goods) and `billing_items` (now the services) — see
// 20261002090000_merge_inventory_and_billing_items_into_items.js.
const TABLE = "items";
// Sell-on-the-website JSON columns (goods only; see 20260909161500_add_sale_fields_to_inventory.js).
const JSON_FIELDS = ["highlights", "includes", "specs", "gallery"];

const ItemsModel = {
  findAll({ ownerAdminId, kind } = {}) {
    let query = db(TABLE);
    if (ownerAdminId) query = query.where({ ownerAdminId });
    if (kind) query = query.where({ kind });
    return query.orderBy("name", "asc");
  },

  findByIds(ids) {
    return db(TABLE).whereIn("id", ids);
  },

  findById(id) {
    return firstOrNull(db(TABLE).where({ id }));
  },

  // The designated public-content admin's Goods marked for sale — the one query the public
  // /api/public/store endpoints run. `ownerAdminId` is required (a missing scope would leak every
  // tenant's for-sale items to an anonymous visitor), mirroring AssessmentModel.findForSaleProjects.
  findForSaleItems(ownerAdminId) {
    if (!ownerAdminId) throw new Error("findForSaleItems requires an ownerAdminId");
    return db(TABLE)
      .where({ ownerAdminId, kind: "goods", saleStatus: "for_sale" })
      .orderBy("createdAt", "desc");
  },

  create(data) {
    return createRecord(db, TABLE, stringifyJsonFields(data, JSON_FIELDS));
  },

  update(id, data) {
    return updateRecord(db, TABLE, id, stringifyJsonFields(data, JSON_FIELDS));
  },

  delete(id) {
    return deleteRecord(db, TABLE, id);
  },
};

module.exports = ItemsModel;
