const db = require("../../config/db");
const { createRecord, updateRecord, deleteRecord, firstOrNull, stringifyJsonFields } = require("../../shared/utils/model.utils");

const TABLE = "home_learning_packages";
const JSON_FIELDS = ["features"];
const ordered = (query) => query.orderBy([{ column: "sortOrder", order: "asc" }, { column: "monthlyAmount", order: "asc" }, { column: "name", order: "asc" }]);

const HomeLearningPackageModel = {
  findAll(ownerAdminId, { publishedOnly = false } = {}) {
    let query = db(TABLE).where({ ownerAdminId });
    if (publishedOnly) query = query.where({ isPublished: true, status: "active" });
    return ordered(query);
  },

  findById(id, ownerAdminId) {
    return firstOrNull(db(TABLE).where({ id, ownerAdminId }));
  },

  // A package by its id or slug — how the website and enquiries refer to one.
  findByIdOrSlug(idOrSlug, ownerAdminId) {
    return firstOrNull(db(TABLE).where({ ownerAdminId }).andWhere((q) => q.where({ id: idOrSlug }).orWhere({ slug: idOrSlug })));
  },

  findBySlug(slug, ownerAdminId) {
    return firstOrNull(db(TABLE).where({ slug, ownerAdminId }));
  },

  async countHouseholds(packageId) {
    const row = await db("home_learning_households").where({ packageId }).count({ count: "*" }).first();
    return Number(row?.count || 0);
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

module.exports = HomeLearningPackageModel;
