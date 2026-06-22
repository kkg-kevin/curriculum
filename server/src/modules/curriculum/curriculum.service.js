const CurriculumModel = require("./curriculum.model");
const CurriculumVersionService = require("./curriculum-versions.service");

const CurriculumService = {
  async createCurriculum(data) {
    const curriculum = CurriculumModel.create(data);
    // Auto-create Version 1 (active) for every new curriculum
    await CurriculumVersionService.createInitialVersion(curriculum);
    return curriculum;
  },

  async getAllCurricula(filters) {
    return CurriculumModel.findAll(filters);
  },

  async getCurriculumById(id) {
    const curriculum = CurriculumModel.findById(id);
    if (!curriculum) {
      const err = new Error("Curriculum not found");
      err.statusCode = 404;
      throw err;
    }
    return curriculum;
  },

  async updateCurriculum(id, data) {
    const curriculum = CurriculumModel.update(id, data);
    if (!curriculum) {
      const err = new Error("Curriculum not found");
      err.statusCode = 404;
      throw err;
    }
    return curriculum;
  },

  async deleteCurriculum(id) {
    const deleted = CurriculumModel.delete(id);
    if (!deleted) {
      const err = new Error("Curriculum not found");
      err.statusCode = 404;
      throw err;
    }
    return { message: "Curriculum deleted successfully" };
  },
};

module.exports = CurriculumService;
