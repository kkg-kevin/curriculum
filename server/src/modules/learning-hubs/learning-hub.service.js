const LearningHubModel = require("./learning-hub.model");
const TeacherHubLinkModel = require("../teachers/teacher-hub-link.model");
const TeacherModel = require("../teachers/teacher.model");
const LearnerHubLinkModel = require("../learners/learner-hub-link.model");
const ClassModel = require("../classes/class.model");
const ClassService = require("../classes/class.service");

const LearningHubService = {
  async createLearningHub(data) {
    return LearningHubModel.create(data);
  },

  // Read-only mirror of TeacherService's link management — teachers are linked to a hub from
  // the teacher side, this just reads the same table back out for hub-scoped consumers
  // (e.g. a school portal's "our teachers" list).
  async getHubTeachers(hubId) {
    const links = await TeacherHubLinkModel.findByHubId(hubId);
    const teachers = await Promise.all(links.map((l) => TeacherModel.findById(l.teacherId)));
    return teachers.filter(Boolean);
  },

  async getAllLearningHubs(filters) {
    return LearningHubModel.findAll(filters);
  },

  async getLearningHubById(id) {
    const record = await LearningHubModel.findById(id);
    if (!record) {
      const err = new Error("Learning hub not found");
      err.statusCode = 404;
      throw err;
    }
    return record;
  },

  async updateLearningHub(id, data) {
    const record = await LearningHubModel.update(id, data);
    if (!record) {
      const err = new Error("Learning hub not found");
      err.statusCode = 404;
      throw err;
    }
    return record;
  },

  async deleteLearningHub(id) {
    const deleted = await LearningHubModel.delete(id);
    if (!deleted) {
      const err = new Error("Learning hub not found");
      err.statusCode = 404;
      throw err;
    }
    await TeacherHubLinkModel.deleteByHubId(id);
    await LearnerHubLinkModel.deleteByHubId(id);
    // Classes are keyed by schoolId === this hub's id, with no other owner once the hub is gone —
    // routed through ClassService.deleteClass (not ClassModel.delete) so every cascade it already
    // handles (timetable, course schedules, attendance, class-owned assessment issues) runs too,
    // instead of duplicating that logic here.
    const classes = await ClassModel.findAll({ schoolId: id });
    for (const cls of classes) {
      await ClassService.deleteClass(cls.id);
    }
    return { message: "Learning hub deleted successfully" };
  },
};

module.exports = LearningHubService;
