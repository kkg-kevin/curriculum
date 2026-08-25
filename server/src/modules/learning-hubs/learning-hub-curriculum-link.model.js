const db = require("../../config/db");
const { generateId, createRecord, updateRecord, firstOrNull } = require("../../shared/utils/model.utils");

const TABLE = "learning_hub_curricula";

const LearningHubCurriculumLinkModel = {
  findAll() {
    return db(TABLE).orderBy("createdAt", "asc");
  },

  findByHubId(hubId) {
    return db(TABLE).where({ hubId }).orderBy("slot", "asc");
  },

  findByCurriculumId(curriculumId) {
    return db(TABLE).where({ curriculumId }).orderBy("createdAt", "asc");
  },

  findCoreByHubId(hubId) {
    return firstOrNull(db(TABLE).where({ hubId, slot: "core" }));
  },

  findSecondaryByHubId(hubId) {
    return firstOrNull(db(TABLE).where({ hubId, slot: "secondary" }));
  },

  findByHubAndCurriculumId(hubId, curriculumId) {
    return firstOrNull(db(TABLE).where({ hubId, curriculumId }));
  },

  findByHubAndSlot(hubId, slot) {
    return firstOrNull(db(TABLE).where({ hubId, slot }));
  },

  async upsertBySlot({ hubId, curriculumId, slot, role, status = "active", startedAt = null, endedAt = null }) {
    const existing = await this.findByHubAndSlot(hubId, slot);
    const data = { hubId, curriculumId, slot, role, status, startedAt, endedAt };
    if (existing) {
      return updateRecord(db, TABLE, existing.id, data);
    }
    return createRecord(db, TABLE, { id: generateId(), ...data });
  },

  update(id, data) {
    return updateRecord(db, TABLE, id, data);
  },

  async delete(id) {
    const count = await db(TABLE).where({ id }).del();
    return count > 0;
  },

  deleteByHubId(hubId) {
    return db(TABLE).where({ hubId }).del();
  },

  deleteByCurriculumId(curriculumId) {
    return db(TABLE).where({ curriculumId }).del();
  },
};

module.exports = LearningHubCurriculumLinkModel;
