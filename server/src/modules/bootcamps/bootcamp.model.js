const db = require("../../config/db");
const {
  createRecord,
  updateRecord,
  deleteRecord,
  firstOrNull,
  stringifyJsonFields,
} = require("../../shared/utils/model.utils");

const TABLE = "bootcamps";
// `highlights` is stored as a JSON column — mysql2 auto-parses it back on read, but doesn't
// auto-serialize a raw JS array on write (see CLAUDE.md), so it goes through stringifyJsonFields.
const JSON_FIELDS = ["highlights"];

const BootcampModel = {
  create(data) {
    return createRecord(db, TABLE, stringifyJsonFields(data, JSON_FIELDS));
  },

  // ownerAdminId optional here so the same findAll can serve callers that scope a different
  // way (none yet — but matches the pattern in curriculum/learning-hub models). Admin-facing
  // controllers always pass it.
  findAll({ ownerAdminId, eventId, saleStatus } = {}) {
    let query = db(TABLE);
    if (ownerAdminId) query = query.where({ ownerAdminId });
    if (eventId) query = query.where({ eventId });
    if (saleStatus) query = query.where({ saleStatus });
    return query.orderBy("createdAt", "desc");
  },

  findById(id) {
    return firstOrNull(db(TABLE).where({ id }));
  },

  // The designated public-content admin's bootcamps marked for sale — the one query the public
  // /api/public/bootcamps endpoint runs. `ownerAdminId` required (a missing scope would leak
  // every tenant's bootcamps), mirroring CompetitionModel.findPublic.
  findPublic(ownerAdminId) {
    if (!ownerAdminId) throw new Error("findPublic requires an ownerAdminId");
    return db(TABLE)
      .where({ ownerAdminId, saleStatus: "for_sale" })
      .orderBy("createdAt", "desc");
  },

  update(id, data) {
    return updateRecord(db, TABLE, id, stringifyJsonFields(data, JSON_FIELDS));
  },

  delete(id) {
    return deleteRecord(db, TABLE, id);
  },
};

module.exports = BootcampModel;
