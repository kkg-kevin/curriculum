const db = require("../../config/db");
const {
  createRecord,
  updateRecord,
  deleteRecord,
  firstOrNull,
  stringifyJsonFields,
} = require("../../shared/utils/model.utils");

const TABLE = "curricula";
// `highlights` is the sell-on-the-website JSON column (see
// 20260910093200_add_sale_fields_to_curricula.js).
const JSON_FIELDS = ["periods", "classes", "competencyWeights", "highlights"];

const CurriculumModel = {
  create(data) {
    return createRecord(db, TABLE, stringifyJsonFields(data, JSON_FIELDS));
  },

  // ownerAdminId optional here for the same reason as learning-hub.model.js's findAll — some
  // callers (e.g. assertUniqueName's curriculum-wide name check) legitimately need every
  // curriculum regardless of tenant. Admin-facing list/detail controllers always pass it.
  findAll({ framework, academicYear, ownerAdminId, isProgram, saleStatus } = {}) {
    let query = db(TABLE);
    if (framework) query = query.where({ framework });
    if (academicYear) query = query.where({ academicYear });
    if (ownerAdminId) query = query.where({ ownerAdminId });
    if (isProgram !== undefined) query = query.where({ isProgram });
    if (saleStatus) query = query.where({ saleStatus });
    return query.orderBy("createdAt", "desc");
  },

  // The designated public-content admin's program-curricula marked for sale — the one query
  // the public /api/public/bootcamps endpoints run. `ownerAdminId` is required (a missing scope
  // would leak every tenant's for-sale bootcamps to an anonymous visitor), mirroring
  // AssessmentModel.findForSaleProjects / InventoryModel.findForSaleItems.
  findForSaleBootcamps(ownerAdminId) {
    if (!ownerAdminId) throw new Error("findForSaleBootcamps requires an ownerAdminId");
    return db(TABLE)
      .where({ ownerAdminId, isProgram: true, saleStatus: "for_sale" })
      .orderBy("createdAt", "desc");
  },

  findById(id) {
    return firstOrNull(db(TABLE).where({ id }));
  },

  update(id, data) {
    return updateRecord(db, TABLE, id, stringifyJsonFields(data, JSON_FIELDS));
  },

  delete(id) {
    return deleteRecord(db, TABLE, id);
  },
};

module.exports = CurriculumModel;
