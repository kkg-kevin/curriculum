const LearningAreaModel = require("./learning-area.model");
const CourseLearningAreaLinkModel = require("../../courses/course-learning-area-link.model");
const AssessmentLearningAreaLinkModel = require("../../assessments/assessment-learning-area-link.model");
const CourseModel = require("../../courses/course.model");

// A Learning Area's `courses` field stores course ids only — reject anything
// that doesn't resolve to a real course so a dummy id can never sneak in.
function assertCoursesExist(courseIds) {
  if (!courseIds) return;
  const missing = courseIds.filter((id) => !CourseModel.findById(id));
  if (missing.length > 0) {
    const err = new Error(`Course(s) not found: ${missing.join(", ")}`);
    err.statusCode = 404;
    throw err;
  }
}

const LearningAreaService = {
  getLearningAreas() {
    return LearningAreaModel.findAll();
  },

  createLearningArea(data) {
    const existing = LearningAreaModel.findAll();
    if (existing.some((a) => a.name.toLowerCase() === data.name.toLowerCase())) {
      const err = new Error("A learning area with this name already exists");
      err.statusCode = 409;
      throw err;
    }
    assertCoursesExist(data.courses);
    return LearningAreaModel.create(data);
  },

  updateLearningArea(id, data) {
    const area = LearningAreaModel.findById(id);
    if (!area) {
      const err = new Error("Learning area not found");
      err.statusCode = 404;
      throw err;
    }
    if (data.name) {
      const others = LearningAreaModel.findAll().filter((a) => a.id !== id);
      if (others.some((a) => a.name.toLowerCase() === data.name.toLowerCase())) {
        const err = new Error("A learning area with this name already exists");
        err.statusCode = 409;
        throw err;
      }
    }
    assertCoursesExist(data.courses);
    return LearningAreaModel.update(id, data);
  },

  deleteLearningArea(id) {
    const area = LearningAreaModel.findById(id);
    if (!area) {
      const err = new Error("Learning area not found");
      err.statusCode = 404;
      throw err;
    }
    LearningAreaModel.delete(id);
    // Deleting the catalog default does not touch copies already imported into
    // curricula — those are independent records (see curriculum learning-area.model.js).
    // Courses/Assessments only ever reference the catalog by id (never copy it), so
    // those references must be cleaned up here or they'd point at a dead id.
    CourseLearningAreaLinkModel.deleteByLearningAreaId(id);
    AssessmentLearningAreaLinkModel.deleteByLearningAreaId(id);
  },
};

module.exports = LearningAreaService;
