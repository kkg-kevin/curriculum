const db = require("../../../config/db");
const { generateId, firstOrNull } = require("../../../shared/utils/model.utils");

const TABLE = "indicator_achievements";

// A curriculum's current score (marks earned) per indicator — the persisted counterpart to
// the marksPossible CompetencyService.getPopulatedIndicators computes live from assessments.
// One row per (curriculumId, indicatorId); `marksPossible` is never stored here, only earned,
// so it can never drift from what assessments currently define.
const IndicatorAchievementModel = {
  findByCurriculumId(curriculumId) {
    return db(TABLE).where({ curriculumId });
  },

  findOne(curriculumId, indicatorId) {
    return firstOrNull(db(TABLE).where({ curriculumId, indicatorId }));
  },

  async upsert(curriculumId, competencyId, indicatorId, marksEarned) {
    const existing = await firstOrNull(db(TABLE).where({ curriculumId, indicatorId }));
    const now = new Date();
    if (!existing) {
      const item = { id: generateId(), curriculumId, competencyId, indicatorId, marksEarned, createdAt: now, updatedAt: now };
      await db(TABLE).insert(item);
      return item;
    }
    await db(TABLE).where({ id: existing.id }).update({ competencyId, marksEarned, updatedAt: now });
    return { ...existing, competencyId, marksEarned, updatedAt: now };
  },

  deleteByCurriculumId(curriculumId) {
    return db(TABLE).where({ curriculumId }).del();
  },

  deleteByCompetencyId(competencyId) {
    return db(TABLE).where({ competencyId }).del();
  },

  deleteByLink(curriculumId, competencyId) {
    return db(TABLE).where({ curriculumId, competencyId }).del();
  },
};

module.exports = IndicatorAchievementModel;
