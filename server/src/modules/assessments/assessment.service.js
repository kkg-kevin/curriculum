const AssessmentModel = require("./assessment.model");

const AssessmentService = {
  async createAssessment(data) {
    return AssessmentModel.create(data);
  },

  async getAllAssessments(filters) {
    return AssessmentModel.findAll(filters);
  },

  async getAssessmentById(id) {
    const assessment = AssessmentModel.findById(id);
    if (!assessment) {
      const err = new Error("Assessment not found");
      err.statusCode = 404;
      throw err;
    }
    return assessment;
  },

  async updateAssessment(id, data) {
    const existing = AssessmentModel.findById(id);
    if (!existing) {
      const err = new Error("Assessment not found");
      err.statusCode = 404;
      throw err;
    }
    return AssessmentModel.update(id, data);
  },

  async deleteAssessment(id) {
    const deleted = AssessmentModel.delete(id);
    if (!deleted) {
      const err = new Error("Assessment not found");
      err.statusCode = 404;
      throw err;
    }
    return { message: "Assessment deleted successfully" };
  },
};

module.exports = AssessmentService;
