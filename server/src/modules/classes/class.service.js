const ClassModel   = require("./class.model");
const LearnerModel = require("../learners/learner.model");

const ClassService = {
  async createClass(data) {
    return ClassModel.create(data);
  },

  async getAllClasses(filters) {
    const classes = ClassModel.findAll(filters);
    const allLearners = LearnerModel.findAll({});
    const countMap = {};
    for (const l of allLearners) {
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
    const record = ClassModel.update(id, data);
    if (!record) {
      const err = new Error("Class not found");
      err.statusCode = 404;
      throw err;
    }
    return record;
  },

  async bulkCreateClasses(items) {
    return Promise.all(items.map((item) => ClassModel.create(item)));
  },

  async deleteClass(id) {
    const deleted = ClassModel.delete(id);
    if (!deleted) {
      const err = new Error("Class not found");
      err.statusCode = 404;
      throw err;
    }
    return { message: "Class deleted successfully" };
  },
};

module.exports = ClassService;
