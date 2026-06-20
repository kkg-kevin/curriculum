const TeacherModel = require("./teacher.model");

const TeacherService = {
  async createTeacher(data) {
    return TeacherModel.create(data);
  },

  async getAllTeachers(filters) {
    return TeacherModel.findAll(filters);
  },

  async getTeacherById(id) {
    const teacher = TeacherModel.findById(id);
    if (!teacher) {
      const err = new Error("Teacher not found");
      err.statusCode = 404;
      throw err;
    }
    return teacher;
  },

  async updateTeacher(id, data) {
    const teacher = TeacherModel.update(id, data);
    if (!teacher) {
      const err = new Error("Teacher not found");
      err.statusCode = 404;
      throw err;
    }
    return teacher;
  },

  async deleteTeacher(id) {
    const deleted = TeacherModel.delete(id);
    if (!deleted) {
      const err = new Error("Teacher not found");
      err.statusCode = 404;
      throw err;
    }
    return { message: "Teacher deleted successfully" };
  },
};

module.exports = TeacherService;
