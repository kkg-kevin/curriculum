const db = require("../../config/db");
const { generateId, firstOrNull } = require("../../shared/utils/model.utils");

const TABLE = "teacher_hub_links";

// Records which learning hubs a teacher is assigned to teach at — a teacher stays one
// independent identity/record, it just gets linked to whichever hub(s) it teaches at,
// same pattern as course-curriculum-link.model.js.
const TeacherHubLinkModel = {
  findByTeacherId(teacherId) {
    return db(TABLE).where({ teacherId });
  },

  findByHubId(hubId) {
    return db(TABLE).where({ hubId });
  },

  async link(teacherId, hubId) {
    const existing = await firstOrNull(db(TABLE).where({ teacherId, hubId }));
    if (existing) return existing;
    const item = { id: generateId(), teacherId, hubId, createdAt: new Date() };
    await db(TABLE).insert(item);
    return item;
  },

  async unlink(teacherId, hubId) {
    const count = await db(TABLE).where({ teacherId, hubId }).del();
    return count > 0;
  },

  deleteByTeacherId(teacherId) {
    return db(TABLE).where({ teacherId }).del();
  },

  deleteByHubId(hubId) {
    return db(TABLE).where({ hubId }).del();
  },
};

module.exports = TeacherHubLinkModel;
