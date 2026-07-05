const crypto = require("crypto");
const CourseModel = require("./course.model");
const SessionModel = require("./session.model");
const CourseCompetencyLinkModel = require("./course-competency-link.model");
const CompetencyModel = require("../competencies/competency.model");
const CourseLearningAreaLinkModel = require("./course-learning-area-link.model");
const LearningAreaModel = require("../learning-areas/learning-area.model");

const generateId = () =>
  typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

const CourseService = {
  async createCourse(data) {
    return CourseModel.create(data);
  },

  async getAllCourses() {
    return CourseModel.findAll().map((course) => ({
      ...course,
      sessionCount: SessionModel.findByCourseId(course.id).length,
    }));
  },

  async getCourseById(id) {
    const course = CourseModel.findById(id);
    if (!course) {
      const err = new Error("Course not found");
      err.statusCode = 404;
      throw err;
    }
    return course;
  },

  async updateCourse(id, data) {
    const existing = CourseModel.findById(id);
    if (!existing) {
      const err = new Error("Course not found");
      err.statusCode = 404;
      throw err;
    }
    return CourseModel.update(id, data);
  },

  async deleteCourse(id) {
    const deleted = CourseModel.delete(id);
    if (!deleted) {
      const err = new Error("Course not found");
      err.statusCode = 404;
      throw err;
    }
    SessionModel.deleteByCourseId(id);
    CourseCompetencyLinkModel.deleteByCourseId(id);
    CourseLearningAreaLinkModel.deleteByCourseId(id);
    return { message: "Course deleted successfully" };
  },

  /* ── Competencies (authored globally in Settings, tagged onto a course here) ── */

  async getCourseCompetencies(courseId) {
    const links = CourseCompetencyLinkModel.findByCourseId(courseId);
    return CompetencyModel.findByIds(links.map((l) => l.competencyId));
  },

  async linkCompetency(courseId, competencyId) {
    const course = CourseModel.findById(courseId);
    if (!course) {
      const err = new Error("Course not found");
      err.statusCode = 404;
      throw err;
    }
    const comp = CompetencyModel.findById(competencyId);
    if (!comp) {
      const err = new Error("Competency not found");
      err.statusCode = 404;
      throw err;
    }
    CourseCompetencyLinkModel.link(courseId, competencyId);
    return this.getCourseCompetencies(courseId);
  },

  async unlinkCompetency(courseId, competencyId) {
    CourseCompetencyLinkModel.unlink(courseId, competencyId);
    return this.getCourseCompetencies(courseId);
  },

  /* ── Learning Areas (authored globally in Settings, tagged onto a course here) ── */

  async getCourseLearningAreas(courseId) {
    const links = CourseLearningAreaLinkModel.findByCourseId(courseId);
    return LearningAreaModel.findByIds(links.map((l) => l.learningAreaId));
  },

  async linkLearningArea(courseId, learningAreaId) {
    const course = CourseModel.findById(courseId);
    if (!course) {
      const err = new Error("Course not found");
      err.statusCode = 404;
      throw err;
    }
    const area = LearningAreaModel.findById(learningAreaId);
    if (!area) {
      const err = new Error("Learning area not found");
      err.statusCode = 404;
      throw err;
    }
    CourseLearningAreaLinkModel.link(courseId, learningAreaId);
    return this.getCourseLearningAreas(courseId);
  },

  async unlinkLearningArea(courseId, learningAreaId) {
    CourseLearningAreaLinkModel.unlink(courseId, learningAreaId);
    return this.getCourseLearningAreas(courseId);
  },

  /* ── Sessions ────────────────────────────────────────────────────────── */

  async getSessions(courseId) {
    const course = CourseModel.findById(courseId);
    if (!course) {
      const err = new Error("Course not found");
      err.statusCode = 404;
      throw err;
    }
    return SessionModel.findByCourseId(courseId);
  },

  async createSession(courseId, data) {
    const course = CourseModel.findById(courseId);
    if (!course) {
      const err = new Error("Course not found");
      err.statusCode = 404;
      throw err;
    }
    const order = data.order ?? SessionModel.findByCourseId(courseId).length + 1;
    return SessionModel.create({ courseId, ...data, order });
  },

  async createSessionsBulk(courseId, count) {
    const course = CourseModel.findById(courseId);
    if (!course) {
      const err = new Error("Course not found");
      err.statusCode = 404;
      throw err;
    }
    const startOrder = SessionModel.findByCourseId(courseId).length + 1;
    const sessionsData = Array.from({ length: count }, (_, i) => ({
      courseId,
      title: "",
      order: startOrder + i,
      outcomes: [],
      introduction: "",
      iceBreaker: "",
      mainConcepts: [{ id: generateId(), title: "Introduction", content: "" }],
      activities: [{ id: generateId(), title: "", classActivity: "", wrapActivity: "" }],
      notes: [{ id: generateId(), title: "", content: "" }],
      resources: [],
    }));
    return SessionModel.createMany(sessionsData);
  },

  async updateSession(courseId, sessionId, data) {
    const course = CourseModel.findById(courseId);
    if (!course) {
      const err = new Error("Course not found");
      err.statusCode = 404;
      throw err;
    }
    const session = SessionModel.findById(sessionId);
    if (!session || session.courseId !== courseId) {
      const err = new Error("Session not found");
      err.statusCode = 404;
      throw err;
    }
    return SessionModel.update(sessionId, data);
  },

  async deleteSession(courseId, sessionId) {
    const course = CourseModel.findById(courseId);
    if (!course) {
      const err = new Error("Course not found");
      err.statusCode = 404;
      throw err;
    }
    const session = SessionModel.findById(sessionId);
    if (!session || session.courseId !== courseId) {
      const err = new Error("Session not found");
      err.statusCode = 404;
      throw err;
    }
    SessionModel.delete(sessionId);
  },
};

module.exports = CourseService;
