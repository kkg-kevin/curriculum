const db = require("../../../config/db");
const { generateId, firstOrNull } = require("../../../shared/utils/model.utils");

const TABLE = "class_group_members";

const ClassGroupMemberModel = {
  findByGroupId(groupId) {
    return db(TABLE).where({ groupId });
  },

  findByGroupIds(groupIds) {
    if (!groupIds.length) return Promise.resolve([]);
    return db(TABLE).whereIn("groupId", groupIds);
  },

  findByLearnerId(learnerId) {
    return db(TABLE).where({ learnerId });
  },

  findOne(groupId, learnerId) {
    return firstOrNull(db(TABLE).where({ groupId, learnerId }));
  },

  // Adds a learner to a group, first removing any membership they hold in a sibling group
  // (siblingGroupIds — every other group in the same class) — enforces "one group per class per
  // learner" at write time, same "just fix the state" posture as
  // class-course-teacher-link.model.js's setPrimary, since classId lives on class_groups, not
  // here, so there's no DB constraint that can express this directly.
  async addExclusive(groupId, learnerId, siblingGroupIds) {
    const existing = await firstOrNull(db(TABLE).where({ groupId, learnerId }));
    if (existing) return existing;
    const record = { id: generateId(), groupId, learnerId, createdAt: new Date() };
    await db.transaction(async (trx) => {
      if (siblingGroupIds.length) await trx(TABLE).where({ learnerId }).whereIn("groupId", siblingGroupIds).del();
      await trx(TABLE).insert(record);
    });
    return record;
  },

  remove(groupId, learnerId) {
    return db(TABLE).where({ groupId, learnerId }).del();
  },

  deleteByGroupId(groupId) {
    return db(TABLE).where({ groupId }).del();
  },

  deleteByGroupIds(groupIds) {
    if (!groupIds.length) return Promise.resolve(0);
    return db(TABLE).whereIn("groupId", groupIds).del();
  },

  deleteByLearnerId(learnerId) {
    return db(TABLE).where({ learnerId }).del();
  },
};

module.exports = ClassGroupMemberModel;
