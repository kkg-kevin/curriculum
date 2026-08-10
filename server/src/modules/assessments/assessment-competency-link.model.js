const db = require("../../config/db");
const { generateId, firstOrNull } = require("../../shared/utils/model.utils");

const TABLE = "assessment_competency_links";

// Records which global competencies an assessment has been tagged with — an assessment
// never owns/authors competencies, it just links to entries from the shared catalog.
const AssessmentCompetencyLinkModel = {
  findByAssessmentId(assessmentId) {
    return db(TABLE).where({ assessmentId });
  },

  async link(assessmentId, competencyId) {
    const existing = await firstOrNull(db(TABLE).where({ assessmentId, competencyId }));
    if (existing) return existing;
    const item = { id: generateId(), assessmentId, competencyId, createdAt: new Date() };
    await db(TABLE).insert(item);
    return item;
  },

  async unlink(assessmentId, competencyId) {
    const count = await db(TABLE).where({ assessmentId, competencyId }).del();
    return count > 0;
  },

  deleteByAssessmentId(assessmentId) {
    return db(TABLE).where({ assessmentId }).del();
  },

  deleteByCompetencyId(competencyId) {
    return db(TABLE).where({ competencyId }).del();
  },
};

module.exports = AssessmentCompetencyLinkModel;
