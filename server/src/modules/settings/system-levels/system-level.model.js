const db = require("../../../config/db");
const { generateId, updateRecord, deleteRecord, firstOrNull } = require("../../../shared/utils/model.utils");

const TABLE = "system_levels";

// The fixed, cross-curriculum spine every curriculum's grades map onto (see
// Curriculum.classes[].systemLevelId) — one global list, not per-curriculum, so "Level 6"
// means the same developmental position everywhere regardless of what any one curriculum
// calls it. Always read/returned in sequence order since that order is the entire point.
const SystemLevelModel = {
  findAll() {
    return db(TABLE).orderBy("sequence", "asc");
  },

  findById(id) {
    return firstOrNull(db(TABLE).where({ id }));
  },

  async create(data) {
    const [{ maxSequence }] = await db(TABLE).max({ maxSequence: "sequence" });
    const now = new Date();
    const item = { ...data, id: generateId(), sequence: (maxSequence || 0) + 1, createdAt: now, updatedAt: now };
    await db(TABLE).insert(item);
    return item;
  },

  update(id, data) {
    return updateRecord(db, TABLE, id, data);
  },

  delete(id) {
    return deleteRecord(db, TABLE, id);
  },

  // Re-numbers sequence 1..N to match the given id order — same pattern as
  // performance-band.model.js's reorder.
  async reorder(orderedIds) {
    await Promise.all(orderedIds.map((id, i) => db(TABLE).where({ id }).update({ sequence: i + 1 })));
    return SystemLevelModel.findAll();
  },
};

module.exports = SystemLevelModel;
