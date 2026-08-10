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
