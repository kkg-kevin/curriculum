const db = require("../../../config/db");
const {
  createRecord,
  updateRecord,
  deleteRecord,
  firstOrNull,
  stringifyJsonFields,
} = require("../../../shared/utils/model.utils");

const TABLE = "inventory";
// Sell-on-the-website JSON columns (see 20260909161500_add_sale_fields_to_inventory.js).
const JSON_FIELDS = ["highlights", "includes", "specs", "gallery"];

const InventoryModel = {
  findAll({ ownerAdminId } = {}) {
    let query = db(TABLE);
    if (ownerAdminId) query = query.where({ ownerAdminId });
    return query;
  },
  findByIds(ids) {
    return db(TABLE).whereIn("id", ids);
  },
  findById(id) {
    return firstOrNull(db(TABLE).where({ id }));
  },

  // The designated public-content admin's inventory items marked for sale — the one query the
  // public /api/public/store endpoints run. `ownerAdminId` is required (a missing scope would
  // leak every tenant's for-sale items to an anonymous visitor), mirroring
  // AssessmentModel.findForSaleProjects.
  findForSaleItems(ownerAdminId) {
    if (!ownerAdminId) throw new Error("findForSaleItems requires an ownerAdminId");
    return db(TABLE)
      .where({ ownerAdminId, saleStatus: "for_sale" })
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

module.exports = InventoryModel;
