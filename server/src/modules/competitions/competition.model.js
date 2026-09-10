const db = require("../../config/db");
const {
  createRecord,
  updateRecord,
  deleteRecord,
  firstOrNull,
  stringifyJsonFields,
} = require("../../shared/utils/model.utils");

const TABLE = "competitions";
// `tracks` is stored as a JSON column — mysql2 auto-parses it back on read, but doesn't
// auto-serialize a raw JS array on write (see CLAUDE.md), so it goes through stringifyJsonFields.
const JSON_FIELDS = ["tracks"];

const CompetitionModel = {
  create(data) {
    return createRecord(db, TABLE, stringifyJsonFields(data, JSON_FIELDS));
  },

  // ownerAdminId optional here so the same findAll can serve callers that scope a different
  // way (none yet — but matches the pattern in curriculum/learning-hub models). Admin-facing
  // controllers always pass it.
  findAll({ ownerAdminId, programId, status, isPublic } = {}) {
    let query = db(TABLE);
    if (ownerAdminId) query = query.where({ ownerAdminId });
    if (programId) query = query.where({ programId });
    if (status) query = query.where({ status });
    if (isPublic !== undefined) query = query.where({ isPublic });
    return query.orderBy("createdAt", "desc");
  },

  findById(id) {
    return firstOrNull(db(TABLE).where({ id }));
  },

  // The designated public-content admin's competitions that are marked public AND not draft —
  // the one query the public /api/public/competitions endpoint runs. `ownerAdminId` required
  // (a missing scope would leak every tenant's competitions), mirroring
  // AssessmentModel.findForSaleProjects / CurriculumModel.findForSaleBootcamps.
  findPublic(ownerAdminId) {
    if (!ownerAdminId) throw new Error("findPublic requires an ownerAdminId");
    return db(TABLE)
      .where({ ownerAdminId, isPublic: true })
      .whereNot({ status: "draft" })
      .orderBy("createdAt", "desc");
  },

  update(id, data) {
    return updateRecord(db, TABLE, id, stringifyJsonFields(data, JSON_FIELDS));
  },

  delete(id) {
    return deleteRecord(db, TABLE, id);
  },
};

module.exports = CompetitionModel;
