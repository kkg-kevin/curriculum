const TeacherModel = require("./teacher.model");
const TeacherHubLinkModel = require("./teacher-hub-link.model");
const LearningHubModel = require("../learning-hubs/learning-hub.model");

const TeacherService = {
  async createTeacher(data) {
    return TeacherModel.create(data);
  },

  async getTeacherHubs(teacherId) {
    return TeacherHubLinkModel.findByTeacherId(teacherId)
      .map((l) => LearningHubModel.findById(l.hubId))
      .filter(Boolean);
  },

  async linkHub(teacherId, hubId) {
    if (!TeacherModel.findById(teacherId)) {
      const err = new Error("Teacher not found");
      err.statusCode = 404;
      throw err;
    }
    if (!LearningHubModel.findById(hubId)) {
      const err = new Error("Learning hub not found");
      err.statusCode = 404;
      throw err;
    }
    TeacherHubLinkModel.link(teacherId, hubId);
    return TeacherService.getTeacherHubs(teacherId);
  },

  async unlinkHub(teacherId, hubId) {
    TeacherHubLinkModel.unlink(teacherId, hubId);
    return TeacherService.getTeacherHubs(teacherId);
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
    TeacherHubLinkModel.deleteByTeacherId(id);
    return { message: "Teacher deleted successfully" };
  },
};

module.exports = TeacherService;
