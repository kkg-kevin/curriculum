const db = require("../../config/db");
const { generateId, firstOrNull } = require("../../shared/utils/model.utils");

const TABLE = "course_learning_area_links";

// Records which global learning areas a course has been tagged with — a course never
// owns/authors learning areas, it just links to entries from the shared catalog.
const CourseLearningAreaLinkModel = {
  findByCourseId(courseId) {
    return db(TABLE).where({ courseId });
  },

  async link(courseId, learningAreaId) {
    const existing = await firstOrNull(db(TABLE).where({ courseId, learningAreaId }));
    if (existing) return existing;
    const item = { id: generateId(), courseId, learningAreaId, createdAt: new Date() };
    await db(TABLE).insert(item);
    return item;
  },

  async unlink(courseId, learningAreaId) {
    const count = await db(TABLE).where({ courseId, learningAreaId }).del();
    return count > 0;
  },

  deleteByCourseId(courseId) {
    return db(TABLE).where({ courseId }).del();
  },

  deleteByLearningAreaId(learningAreaId) {
    return db(TABLE).where({ learningAreaId }).del();
  },
};

module.exports = CourseLearningAreaLinkModel;
