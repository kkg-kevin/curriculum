const LearnerModel = require("./learner.model");
const SchoolModel = require("../schools/school.model");

const generateAdmissionNumber = (schoolCode, year) => {
  const prefix = `${schoolCode.toUpperCase()}-${year}`;
  const count = LearnerModel.countByPrefix(prefix);
  const seq = String(count + 1).padStart(3, "0");
  return `${prefix}-${seq}`;
};

const LearnerService = {
  async createLearner(data) {
    const school = SchoolModel.findById(data.schoolId);
    if (!school) {
      const err = new Error("School not found");
      err.statusCode = 404;
      throw err;
    }
    const year = new Date().getFullYear();
    const admissionNumber = generateAdmissionNumber(school.code, year);
    return LearnerModel.create({ ...data, admissionNumber });
  },

  async getAllLearners(filters) {
    return LearnerModel.findAll(filters);
  },

  async getLearnerById(id) {
    const record = LearnerModel.findById(id);
    if (!record) {
      const err = new Error("Learner not found");
      err.statusCode = 404;
      throw err;
    }
    return record;
  },

  async updateLearner(id, data) {
    const record = LearnerModel.update(id, data);
    if (!record) {
      const err = new Error("Learner not found");
      err.statusCode = 404;
      throw err;
    }
    return record;
  },

  async deleteLearner(id) {
    const deleted = LearnerModel.delete(id);
    if (!deleted) {
      const err = new Error("Learner not found");
      err.statusCode = 404;
      throw err;
    }
    return { message: "Learner deleted successfully" };
  },
};

module.exports = LearnerService;
