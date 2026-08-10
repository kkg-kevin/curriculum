const db = require("../../config/db");
const { generateId, firstOrNull } = require("../../shared/utils/model.utils");

const TABLE = "course_curriculum_links";

// Records which curricula a course has been added to — a course stays independent and
// reusable, it just gets referenced by a curriculum when needed, same as the competency links.
const CourseCurriculumLinkModel = {
  findByCourseId(courseId) {
    return db(TABLE).where({ courseId });
  },

  findByCurriculumId(curriculumId) {
    return db(TABLE).where({ curriculumId });
  },

  async link(courseId, curriculumId) {
    const existing = await firstOrNull(db(TABLE).where({ courseId, curriculumId }));
    if (existing) return existing;
    const item = { id: generateId(), courseId, curriculumId, createdAt: new Date() };
    await db(TABLE).insert(item);
    return item;
  },

  async unlink(courseId, curriculumId) {
    const count = await db(TABLE).where({ courseId, curriculumId }).del();
    return count > 0;
  },

  deleteByCourseId(courseId) {
    return db(TABLE).where({ courseId }).del();
  },

  deleteByCurriculumId(curriculumId) {
    return db(TABLE).where({ curriculumId }).del();
  },
};

module.exports = CourseCurriculumLinkModel;
