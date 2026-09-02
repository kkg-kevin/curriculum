const db = require("../../config/db");
const {
  createRecord,
  updateRecord,
  deleteRecord,
  firstOrNull,
  stringifyJsonFields,
} = require("../../shared/utils/model.utils");

const TABLE = "public_projects";
const JSON_FIELDS = ["requirements", "modules"];

const PublicProjectModel = {
  create(data) {
    return createRecord(db, TABLE, stringifyJsonFields(data, JSON_FIELDS));
  },

  findAll({ publishedOnly = false } = {}) {
    const query = db(TABLE).orderBy("createdAt", "desc");
    if (publishedOnly) query.where({ isPublished: true });
    return query;
  },

  findById(id) {
    return firstOrNull(db(TABLE).where({ id }));
  },

  findByIdOrSlug(idOrSlug) {
    return firstOrNull(db(TABLE).where({ id: idOrSlug }).orWhere({ slug: idOrSlug }));
  },

  findBySlug(slug) {
    return firstOrNull(db(TABLE).where({ slug }));
  },

  update(id, data) {
    return updateRecord(db, TABLE, id, stringifyJsonFields(data, JSON_FIELDS));
  },

  delete(id) {
    return deleteRecord(db, TABLE, id);
  },
};

module.exports = PublicProjectModel;
