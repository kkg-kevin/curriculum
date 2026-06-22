const SchoolModel = require("./school.model");
const SupplementaryModel = require("../supplementary/supplementary.model");

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
    const existing = SchoolModel.findById(id);
    if (!existing) {
      const err = new Error("School not found");
      err.statusCode = 404;
      throw err;
    }

    const curriculumChanged =
      data.curriculumId !== undefined &&
      data.curriculumId !== existing.curriculumId;

    if (curriculumChanged) {
      const related = SupplementaryModel.findAll({ schoolId: id });

      // Delete supplementary this school owns — built on the old curriculum structure
      related
        .filter((s) => s.schoolId === id)
        .forEach((s) => SupplementaryModel.delete(s.id));

      // Remove this school from assignments on supplementary owned by others
      related
        .filter((s) => s.schoolId !== id)
        .forEach((s) => {
          const trimmed = (s.assignments || []).filter((a) => a.schoolId !== id);
          SupplementaryModel.update(s.id, { assignments: trimmed });
        });
    }

    return SchoolModel.update(id, data);
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
