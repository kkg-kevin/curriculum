const ClassModel   = require("./class.model");
const LearnerHubLinkModel = require("../learners/learner-hub-link.model");
const ClassCourseTeacherLinkModel = require("./class-course-teacher-link.model");

// Tag is unique across every class, system-wide (not just within one hub) — it's how a specific
// class instance gets referenced unambiguously in reports/attendance even though many hubs can
// share the same gradeId/gradeName off the same curriculum. excludeId skips the record being
// updated so re-saving a class's own unchanged tag doesn't collide with itself.
function assertTagAvailable(tag, excludeId) {
  if (!tag) return;
  const others = ClassModel.findAll().filter((c) => c.id !== excludeId);
  if (others.some((c) => c.tag && c.tag.toLowerCase() === tag.toLowerCase())) {
    const err = new Error("A class with this tag already exists");
    err.statusCode = 409;
    throw err;
  }
}

const ClassService = {
  async createClass(data) {
    assertTagAvailable(data.tag, null);
    return ClassModel.create(data);
  },

  async getAllClasses(filters) {
    const classes = ClassModel.findAll(filters);
    const allLinks = LearnerHubLinkModel.findAll();
    const countMap = {};
    for (const l of allLinks) {
      if (!l.classId) continue;
      countMap[l.classId] = (countMap[l.classId] || 0) + 1;
    }
    return classes.map((c) => ({ ...c, learnerCount: countMap[c.id] || 0 }));
  },

  async getClassById(id) {
    const record = ClassModel.findById(id);
    if (!record) {
      const err = new Error("Class not found");
      err.statusCode = 404;
      throw err;
    }
    return record;
  },

  async updateClass(id, data) {
    if (data.tag !== undefined) assertTagAvailable(data.tag, id);
    const record = ClassModel.update(id, data);
    if (!record) {
      const err = new Error("Class not found");
      err.statusCode = 404;
      throw err;
    }
    return record;
  },

  async bulkCreateClasses(items) {
    // Bulk-created items (Set Up Year, Program deployment) never carry a tag today, but guard
    // against both a collision with an already-saved class and a duplicate within this same
    // batch, same as a one-at-a-time create would catch.
    const seen = new Set();
    for (const item of items) {
      if (!item.tag) continue;
      const key = item.tag.toLowerCase();
      if (seen.has(key)) {
        const err = new Error("A class with this tag already exists");
        err.statusCode = 409;
        throw err;
      }
      seen.add(key);
      assertTagAvailable(item.tag, null);
    }
    return Promise.all(items.map((item) => ClassModel.create(item)));
  },

  async deleteClass(id) {
    const deleted = ClassModel.delete(id);
    if (!deleted) {
      const err = new Error("Class not found");
      err.statusCode = 404;
      throw err;
    }
    // Learners enrolled here stay enrolled at the hub, just no longer placed in a class.
    LearnerHubLinkModel.clearClassId(id);
    ClassCourseTeacherLinkModel.deleteByClassId(id);
    return { message: "Class deleted successfully" };
  },
};

module.exports = ClassService;
