const db = require("../../config/db");
const {
  createRecord,
  updateRecord,
  deleteRecord,
  firstOrNull,
  stringifyJsonFields,
} = require("../../shared/utils/model.utils");

const TABLE = "learning_hubs";
const JSON_FIELDS = ["address", "photos", "amenities", "operatingHours", "spaces"];

const LearningHubModel = {
  create(data) {
    return createRecord(db, TABLE, stringifyJsonFields(data, JSON_FIELDS));
  },

  // ownerAdminId is optional here (unlike the mandatory withOwnerScope path some callers use
  // instead) because this same findAll is also called for non-admin roles that scope themselves
  // a different way (e.g. "school" via `email`, above) and have no ownerAdminId of their own to
  // pass. Admin-facing controllers must always pass it explicitly for an admin-role request —
  // see learning-hub.controller.js's getAllLearningHubs.
  async findAll({ status, county, curriculumId, parentHubId, email, hubType, includeDrafts, ownerAdminId } = {}) {
    let query = db(TABLE);
    if (status) query = query.where({ status });
    // Drafts are staged records still being set up in Settings — hidden from every listing by
    // default so they don't leak into pickers/dashboards until an admin activates them. Callers
    // that need to see them (Settings' own management view, a school viewing its own record)
    // pass includeDrafts explicitly. An explicit `status` filter already implies this.
    else if (!includeDrafts) query = query.whereNot({ status: "draft" });
    if (curriculumId) query = query.where({ curriculumId });
    if (parentHubId) query = query.where({ parentHubId });
    if (email) query = query.whereRaw("LOWER(email) = ?", [email.toLowerCase()]);
    if (hubType) query = query.where({ hubType });
    if (ownerAdminId) query = query.where({ ownerAdminId });

    let rows = await query.orderBy("createdAt", "desc");
    // `address` is a JSON column (mysql2 returns it already parsed) — county isn't its own
    // column, so this filter runs in JS same as the JSON-file era.
    if (county) rows = rows.filter((r) => r.address?.county === county);
    return rows;
  },

  findById(id) {
    return firstOrNull(db(TABLE).where({ id }));
  },

  update(id, data) {
    return updateRecord(db, TABLE, id, stringifyJsonFields(data, JSON_FIELDS));
  },

  clearCurriculumId(curriculumId) {
    return db(TABLE).where({ curriculumId }).update({ curriculumId: null, updatedAt: new Date() });
  },

  clearCurriculumIdByHubId(hubId) {
    return db(TABLE).where({ id: hubId }).update({ curriculumId: null, updatedAt: new Date() });
  },

  delete(id) {
    return deleteRecord(db, TABLE, id);
  },
};

module.exports = LearningHubModel;
