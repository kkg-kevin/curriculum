const db = require("../../config/db");
const { generateId, firstOrNull } = require("../../shared/utils/model.utils");

const TABLE = "course_competency_links";

// Records which global competencies a course has been tagged with — a course never
// owns/authors competencies, it just links to entries from the shared catalog.
const CourseCompetencyLinkModel = {
  findByCourseId(courseId) {
    return db(TABLE).where({ courseId });
  },

  async link(courseId, competencyId) {
    const existing = await firstOrNull(db(TABLE).where({ courseId, competencyId }));
    if (existing) return existing;
    const item = { id: generateId(), courseId, competencyId, createdAt: new Date() };
    await db(TABLE).insert(item);
    return item;
  },

  async unlink(courseId, competencyId) {
    const count = await db(TABLE).where({ courseId, competencyId }).del();
    return count > 0;
  },

  deleteByCourseId(courseId) {
    return db(TABLE).where({ courseId }).del();
  },

  deleteByCompetencyId(competencyId) {
    return db(TABLE).where({ competencyId }).del();
  },
};

module.exports = CourseCompetencyLinkModel;
