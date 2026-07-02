const CourseModel = require("./course.model");

const CourseService = {
  async createCourse(data) {
    return CourseModel.create(data);
  },

  async getAllCourses(filters) {
    return CourseModel.findAll(filters);
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
    return { message: "Course deleted successfully" };
  },
};

module.exports = CourseService;
