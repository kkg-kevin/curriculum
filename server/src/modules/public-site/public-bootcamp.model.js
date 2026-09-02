const db = require("../../config/db");
const {
  createRecord,
  updateRecord,
  deleteRecord,
  firstOrNull,
  stringifyJsonFields,
} = require("../../shared/utils/model.utils");

const TABLE = "public_bootcamps";
const JSON_FIELDS = ["classes", "courses"];

const PublicBootcampModel = {
  create(data) {
    return createRecord(db, TABLE, stringifyJsonFields(data, JSON_FIELDS));
  },

  // publishedOnly: true for the public GET (the landing site never sees a draft); false/omitted
  // for the admin list, which needs to see everything including unpublished drafts.
  findAll({ publishedOnly = false } = {}) {
    const query = db(TABLE).orderBy("createdAt", "desc");
    if (publishedOnly) query.where({ isPublished: true });
    return query;
  },

  findById(id) {
    return firstOrNull(db(TABLE).where({ id }));
  },

  // The public detail route accepts either an id or a slug (mirrors bootcampDetail() in the
  // frontend's mock fixture) — a slug is what the site's own bootcamp cards link with.
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

module.exports = PublicBootcampModel;
