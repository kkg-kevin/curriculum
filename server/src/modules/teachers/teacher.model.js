const db = require("../../config/db");
const {
  createRecord,
  updateRecord,
  deleteRecord,
  firstOrNull,
  stringifyJsonFields,
} = require("../../shared/utils/model.utils");

const TABLE = "teachers";
const JSON_FIELDS = ["qualifiedCourseIds"];

const TeacherModel = {
  create(data) {
    return createRecord(db, TABLE, stringifyJsonFields(data, JSON_FIELDS));
  },

  async findAll({ ids, status, subject, email } = {}) {
    let query = db(TABLE);
    if (ids) query = query.whereIn("id", ids);
    if (status) query = query.where({ status });
    if (email) query = query.whereRaw("LOWER(email) = ?", [email.toLowerCase()]);

    let rows = await query.orderBy("createdAt", "desc");
    // `subjects` isn't a real column (dead/legacy filter — teachers.json never had that
    // field either, superseded by qualifiedCourseIds) — preserved as-is rather than fixed,
    // same as the JSON-file era: this always filters out every row when `subject` is passed.
    if (subject) rows = rows.filter((t) => t.subjects?.includes(subject));
    return rows;
  },

  // Ids of every teacher this admin's tenant created (see the createdByAdminId migration) — how
  // an admin still reaches a teacher that isn't linked to any of their hubs yet.
  async findIdsCreatedByAdmin(adminId) {
    if (!adminId) return [];
    const rows = await db(TABLE).where({ createdByAdminId: adminId }).select("id");
    return rows.map((r) => r.id);
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

module.exports = TeacherModel;
