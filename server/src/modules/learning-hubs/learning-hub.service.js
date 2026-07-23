const LearningHubModel = require("./learning-hub.model");
const TeacherHubLinkModel = require("../teachers/teacher-hub-link.model");
const TeacherModel = require("../teachers/teacher.model");
const LearnerHubLinkModel = require("../learners/learner-hub-link.model");

const LearningHubService = {
  async createLearningHub(data) {
    return LearningHubModel.create(data);
  },

  // Read-only mirror of TeacherService's link management — teachers are linked to a hub from
  // the teacher side, this just reads the same table back out for hub-scoped consumers
  // (e.g. a school portal's "our teachers" list).
  async getHubTeachers(hubId) {
    return TeacherHubLinkModel.findByHubId(hubId)
      .map((l) => TeacherModel.findById(l.teacherId))
      .filter(Boolean);
  },

  async getAllLearningHubs(filters) {
    return LearningHubModel.findAll(filters);
  },

  async getLearningHubById(id) {
    const record = LearningHubModel.findById(id);
    if (!record) {
      const err = new Error("Learning hub not found");
      err.statusCode = 404;
      throw err;
    }
    return record;
  },

  async updateLearningHub(id, data) {
    const record = LearningHubModel.update(id, data);
    if (!record) {
      const err = new Error("Learning hub not found");
      err.statusCode = 404;
      throw err;
    }
    return record;
  },

  async deleteLearningHub(id) {
    const deleted = LearningHubModel.delete(id);
    if (!deleted) {
      const err = new Error("Learning hub not found");
      err.statusCode = 404;
      throw err;
    }
    TeacherHubLinkModel.deleteByHubId(id);
    LearnerHubLinkModel.deleteByHubId(id);
    return { message: "Learning hub deleted successfully" };
  },
};

module.exports = LearningHubService;
