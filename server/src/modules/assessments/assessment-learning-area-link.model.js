const db = require("../../config/db");
const { generateId, firstOrNull } = require("../../shared/utils/model.utils");

const TABLE = "assessment_learning_area_links";

// Records which global learning areas an assessment has been tagged with — an assessment
// never owns/authors learning areas, it just links to entries from the shared catalog.
const AssessmentLearningAreaLinkModel = {
  findByAssessmentId(assessmentId) {
    return db(TABLE).where({ assessmentId });
  },

  async link(assessmentId, learningAreaId) {
    const existing = await firstOrNull(db(TABLE).where({ assessmentId, learningAreaId }));
    if (existing) return existing;
    const item = { id: generateId(), assessmentId, learningAreaId, createdAt: new Date() };
    await db(TABLE).insert(item);
    return item;
  },

  async unlink(assessmentId, learningAreaId) {
    const count = await db(TABLE).where({ assessmentId, learningAreaId }).del();
    return count > 0;
  },

  deleteByAssessmentId(assessmentId) {
    return db(TABLE).where({ assessmentId }).del();
  },

  deleteByLearningAreaId(learningAreaId) {
    return db(TABLE).where({ learningAreaId }).del();
  },
};

module.exports = AssessmentLearningAreaLinkModel;
