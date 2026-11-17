const db = require("../../../config/db");
const {
  createRecord,
  updateRecord,
  firstOrNull,
  stringifyJsonFields,
  whereInChunks,
} = require("../../../shared/utils/model.utils");

const TABLE = "curriculum_versions";
const JSON_FIELDS = ["content"];

const CurriculumVersionModel = {
  findAll() {
    return db(TABLE);
  },

  findAllByCurriculumId(curriculumId) {
    return db(TABLE).where({ curriculumId }).orderBy("versionNumber", "desc");
  },

  // Batch form — every version of many curricula, newest first within each.
  async findAllByCurriculumIds(curriculumIds) {
    const rows = await whereInChunks(db, TABLE, "curriculumId", curriculumIds);
    return rows.sort((a, b) => b.versionNumber - a.versionNumber);
  },

  findById(id) {
    return firstOrNull(db(TABLE).where({ id }));
  },

  // createRecord returns the pre-insert object (content still JSON.stringify'd for the write),
  // not a fresh read — unlike update()'s firstOrNull refetch, which mysql2 auto-parses JSON
  // columns back through. Restore the parsed content here so create()'s return shape matches
  // every other read of this table (the client renders version.content as an array right away).
  async create(data) {
    const record = await createRecord(db, TABLE, stringifyJsonFields(data, JSON_FIELDS));
    return { ...record, content: data.content };
  },

  update(id, changes) {
    return updateRecord(db, TABLE, id, stringifyJsonFields(changes, JSON_FIELDS));
  },

  deleteByCurriculumId(curriculumId) {
    return db(TABLE).where({ curriculumId }).del();
  },
};

module.exports = CurriculumVersionModel;
