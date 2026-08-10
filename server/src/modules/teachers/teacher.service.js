const TeacherModel = require("./teacher.model");
const TeacherHubLinkModel = require("./teacher-hub-link.model");
const LearningHubModel = require("../learning-hubs/learning-hub.model");
const ClassCourseTeacherLinkModel = require("../classes/class-course-teacher-link.model");
const AttendanceModel = require("../attendance/attendance.model");
const AssessmentSubmissionModel = require("../assessments/submissions/assessment-submission.model");
const AssessmentIssueModel = require("../assessments/submissions/assessment-issue.model");

const TeacherService = {
  async createTeacher(data) {
    return TeacherModel.create(data);
  },

  async getTeacherHubs(teacherId) {
    const links = await TeacherHubLinkModel.findByTeacherId(teacherId);
    const hubs = await Promise.all(links.map((l) => LearningHubModel.findById(l.hubId)));
    return hubs.filter(Boolean);
  },

  async linkHub(teacherId, hubId) {
    if (!(await TeacherModel.findById(teacherId))) {
      const err = new Error("Teacher not found");
      err.statusCode = 404;
      throw err;
    }
    if (!(await LearningHubModel.findById(hubId))) {
      const err = new Error("Learning hub not found");
      err.statusCode = 404;
      throw err;
    }
    await TeacherHubLinkModel.link(teacherId, hubId);
    return TeacherService.getTeacherHubs(teacherId);
  },

  async unlinkHub(teacherId, hubId) {
    await TeacherHubLinkModel.unlink(teacherId, hubId);
    return TeacherService.getTeacherHubs(teacherId);
  },

  async getAllTeachers(filters) {
    return TeacherModel.findAll(filters);
  },

  async getTeacherById(id) {
    const teacher = await TeacherModel.findById(id);
    if (!teacher) {
      const err = new Error("Teacher not found");
      err.statusCode = 404;
      throw err;
    }
    return teacher;
  },

  async updateTeacher(id, data) {
    const teacher = await TeacherModel.update(id, data);
    if (!teacher) {
      const err = new Error("Teacher not found");
      err.statusCode = 404;
      throw err;
    }
    return teacher;
  },

  async deleteTeacher(id) {
    const deleted = await TeacherModel.delete(id);
    if (!deleted) {
      const err = new Error("Teacher not found");
      err.statusCode = 404;
      throw err;
    }
    await TeacherHubLinkModel.deleteByTeacherId(id);
    await ClassCourseTeacherLinkModel.deleteByTeacherId(id);
    // These are attribution fields, not ownership — the underlying attendance/submission/issue
    // records are real data that outlives the teacher who marked/graded/issued them, so only the
    // stale reference is cleared, never the record.
    await AttendanceModel.clearMarkedBy(id);
    await AssessmentSubmissionModel.clearGradedBy(id);
    await AssessmentIssueModel.clearIssuedBy(id);
    return { message: "Teacher deleted successfully" };
  },
};

module.exports = TeacherService;
