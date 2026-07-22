const LearningHubModel = require("./learning-hub.model");

const LearningHubService = {
  async createLearningHub(data) {
    return LearningHubModel.create(data);
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
    return { message: "Learning hub deleted successfully" };
  },
};

module.exports = LearningHubService;
