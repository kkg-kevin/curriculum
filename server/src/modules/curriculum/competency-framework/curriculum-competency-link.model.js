const db = require("../../../config/db");
const { generateId, firstOrNull } = require("../../../shared/utils/model.utils");

const TABLE = "curriculum_competency_links";

// Records which global competencies a curriculum has adopted — a curriculum no longer
// owns/authors competencies, it just links to entries from the shared catalog.
const CurriculumCompetencyLinkModel = {
  findByCurriculumId(curriculumId) {
    return db(TABLE).where({ curriculumId });
  },

  findOne(curriculumId, competencyId) {
    return firstOrNull(db(TABLE).where({ curriculumId, competencyId }));
  },

  async link(curriculumId, competencyId) {
    const existing = await firstOrNull(db(TABLE).where({ curriculumId, competencyId }));
    if (existing) return existing;
    const item = { id: generateId(), curriculumId, competencyId, minimumThreshold: 60, createdAt: new Date() };
    await db(TABLE).insert(item);
    return item;
  },

  // Threshold is how THIS curriculum evaluates the competency — not a
  // property of the global competency, so it lives on the adoption link.
  async updateLink(curriculumId, competencyId, data) {
    const count = await db(TABLE).where({ curriculumId, competencyId }).update(data);
    if (count === 0) return null;
    return firstOrNull(db(TABLE).where({ curriculumId, competencyId }));
  },

  async unlink(curriculumId, competencyId) {
    const count = await db(TABLE).where({ curriculumId, competencyId }).del();
    return count > 0;
  },

  deleteByCurriculumId(curriculumId) {
    return db(TABLE).where({ curriculumId }).del();
  },

  deleteByCompetencyId(competencyId) {
    return db(TABLE).where({ competencyId }).del();
  },
};

module.exports = CurriculumCompetencyLinkModel;
