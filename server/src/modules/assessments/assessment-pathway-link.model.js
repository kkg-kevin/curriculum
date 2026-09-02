const db = require("../../config/db");
const { generateId, firstOrNull } = require("../../shared/utils/model.utils");

const TABLE = "assessment_pathway_links";

// Records which global pathways an assessment has been tagged with — an assessment
// never owns/authors pathways, it just links to entries from the shared catalog.
const AssessmentPathwayLinkModel = {
  findByAssessmentId(assessmentId) {
    return db(TABLE).where({ assessmentId });
  },

  async link(assessmentId, pathwayId) {
    const existing = await firstOrNull(db(TABLE).where({ assessmentId, pathwayId }));
    if (existing) return existing;
    const item = { id: generateId(), assessmentId, pathwayId, createdAt: new Date() };
    await db(TABLE).insert(item);
    return item;
  },

  async unlink(assessmentId, pathwayId) {
    const count = await db(TABLE).where({ assessmentId, pathwayId }).del();
    return count > 0;
  },

  deleteByAssessmentId(assessmentId) {
    return db(TABLE).where({ assessmentId }).del();
  },

  deleteByPathwayId(pathwayId) {
    return db(TABLE).where({ pathwayId }).del();
  },
};

module.exports = AssessmentPathwayLinkModel;
