const db = require("../../config/db");
const { createRecord, updateRecord, deleteRecord, firstOrNull, stringifyJsonFields } = require("../../shared/utils/model.utils");

const TABLE = "club_packages";
const JSON_FIELDS = ["features", "hubIds"];
const ordered = (query) => query.orderBy([{ column: "sortOrder", order: "asc" }, { column: "amount", order: "asc" }, { column: "name", order: "asc" }]);

// mysql2 parses JSON columns on read; a row saved before a list was set holds null.
const normalise = (pkg) => (pkg ? { ...pkg, features: Array.isArray(pkg.features) ? pkg.features : [], hubIds: Array.isArray(pkg.hubIds) ? pkg.hubIds : [] } : null);

// Same shape as home-learning-package.model.js, for the Tech Club packages (club_packages).
const ClubPackageModel = {
  async findAll(ownerAdminId, { publishedOnly = false } = {}) {
    let query = db(TABLE).where({ ownerAdminId });
    if (publishedOnly) query = query.where({ isPublished: true, status: "active" });
    return (await ordered(query)).map(normalise);
  },

  async findById(id, ownerAdminId) {
    return normalise(await firstOrNull(db(TABLE).where({ id, ownerAdminId })));
  },

  async findBySlug(slug, ownerAdminId) {
    return normalise(await firstOrNull(db(TABLE).where({ slug, ownerAdminId })));
  },

  async countMemberships(packageId) {
    const row = await db("club_memberships").where({ packageId }).count({ count: "*" }).first();
    return Number(row?.count || 0);
  },

  // Re-read after the insert: createRecord returns the row as written, with JSON still as text.
  async create(data) {
    const row = await createRecord(db, TABLE, stringifyJsonFields(data, JSON_FIELDS));
    return normalise(await firstOrNull(db(TABLE).where({ id: row.id })));
  },

  async update(id, data) {
    return normalise(await updateRecord(db, TABLE, id, stringifyJsonFields(data, JSON_FIELDS)));
  },

  delete(id) {
    return deleteRecord(db, TABLE, id);
  },
};

// Whether a package is offered at a club: an empty hubIds list means every club.
ClubPackageModel.offeredAt = (pkg, hubId) => !pkg.hubIds.length || pkg.hubIds.includes(hubId);

module.exports = ClubPackageModel;
