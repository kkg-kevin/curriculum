const SchoolModel = require("./school.model");

const SchoolService = {
  async createSchool(data) {
    return SchoolModel.create(data);
  },

  async getAllSchools(filters) {
    return SchoolModel.findAll(filters);
  },

  async getSchoolById(id) {
    const school = SchoolModel.findById(id);
    if (!school) {
      const err = new Error("School not found");
      err.statusCode = 404;
      throw err;
    }
    return school;
  },

  async updateSchool(id, data) {
    const school = SchoolModel.update(id, data);
    if (!school) {
      const err = new Error("School not found");
      err.statusCode = 404;
      throw err;
    }
    return school;
  },

  async deleteSchool(id) {
    const deleted = SchoolModel.delete(id);
    if (!deleted) {
      const err = new Error("School not found");
      err.statusCode = 404;
      throw err;
    }
    return { message: "School deleted successfully" };
  },
};

module.exports = SchoolService;
