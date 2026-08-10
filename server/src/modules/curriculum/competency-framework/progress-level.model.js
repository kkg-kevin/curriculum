const db = require("../../../config/db");
const { generateId, updateRecord, deleteRecord, firstOrNull } = require("../../../shared/utils/model.utils");

const TABLE = "progress_levels";

const ProgressLevelModel = {
  findByCurriculumId(curriculumId) {
    return db(TABLE).where({ curriculumId }).orderBy("order", "asc");
  },

  findById(id) {
    return firstOrNull(db(TABLE).where({ id }));
  },

  async create(data) {
    const [{ count }] = await db(TABLE).where({ curriculumId: data.curriculumId }).count({ count: "*" });
    const now = new Date();
    const item = { ...data, id: generateId(), order: Number(count) + 1, createdAt: now, updatedAt: now };
    await db(TABLE).insert(item);
    return item;
  },

  update(id, data) {
    return updateRecord(db, TABLE, id, data);
  },

  delete(id) {
    return deleteRecord(db, TABLE, id);
  },

  deleteByCurriculumId(curriculumId) {
    return db(TABLE).where({ curriculumId }).del();
  },
};

module.exports = ProgressLevelModel;
