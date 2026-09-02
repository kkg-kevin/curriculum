const db = require("../../config/db");
const { generateId, firstOrNull } = require("../../shared/utils/model.utils");

const TABLE = "course_pathway_links";

// Records which global pathways a course has been tagged with — a course never
// owns/authors pathways, it just links to entries from the shared catalog.
const CoursePathwayLinkModel = {
  findByCourseId(courseId) {
    return db(TABLE).where({ courseId });
  },

  async link(courseId, pathwayId) {
    const existing = await firstOrNull(db(TABLE).where({ courseId, pathwayId }));
    if (existing) return existing;
    const item = { id: generateId(), courseId, pathwayId, createdAt: new Date() };
    await db(TABLE).insert(item);
    return item;
  },

  async unlink(courseId, pathwayId) {
    const count = await db(TABLE).where({ courseId, pathwayId }).del();
    return count > 0;
  },

  deleteByCourseId(courseId) {
    return db(TABLE).where({ courseId }).del();
  },

  deleteByPathwayId(pathwayId) {
    return db(TABLE).where({ pathwayId }).del();
  },
};

module.exports = CoursePathwayLinkModel;
