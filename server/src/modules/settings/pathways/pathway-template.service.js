const PathwayTemplateModel = require("./pathway-template.model");
const CoursePathwayLinkModel = require("../../courses/course-pathway-link.model");
const AssessmentPathwayLinkModel = require("../../assessments/assessment-pathway-link.model");
const CourseModel = require("../../courses/course.model");

// A Pathway's `courses` field stores course ids only — reject anything
// that doesn't resolve to a real course so a dummy id can never sneak in.
async function assertCoursesExist(courseIds) {
  if (!courseIds) return;
  const found = await Promise.all(courseIds.map((id) => CourseModel.findById(id)));
  const missing = courseIds.filter((id, i) => !found[i]);
  if (missing.length > 0) {
    const err = new Error(`Course(s) not found: ${missing.join(", ")}`);
    err.statusCode = 404;
    throw err;
  }
}

const PathwayTemplateService = {
  async getPathways() {
    return PathwayTemplateModel.findAll();
  },

  async createPathway(data) {
    const existing = await PathwayTemplateModel.findAll();
    if (existing.some((a) => a.name.toLowerCase() === data.name.toLowerCase())) {
      const err = new Error("A pathway with this name already exists");
      err.statusCode = 409;
      throw err;
    }
    await assertCoursesExist(data.courses);
    return PathwayTemplateModel.create(data);
  },

  async updatePathway(id, data) {
    const template = await PathwayTemplateModel.findById(id);
    if (!template) {
      const err = new Error("Pathway template not found");
      err.statusCode = 404;
      throw err;
    }
    if (data.name) {
      const all = await PathwayTemplateModel.findAll();
      const others = all.filter((a) => a.id !== id);
      if (others.some((a) => a.name.toLowerCase() === data.name.toLowerCase())) {
        const err = new Error("A pathway with this name already exists");
        err.statusCode = 409;
        throw err;
      }
    }
    await assertCoursesExist(data.courses);
    return PathwayTemplateModel.update(id, data);
  },

  async deletePathway(id) {
    const template = await PathwayTemplateModel.findById(id);
    if (!template) {
      const err = new Error("Pathway template not found");
      err.statusCode = 404;
      throw err;
    }
    await PathwayTemplateModel.delete(id);
    // Deleting the template does not touch copies already imported into
    // curricula — those are independent records (see curriculum pathway.model.js).
    // Courses/Assessments only ever reference the catalog by id (never copy it), so
    // those references must be cleaned up here or they'd point at a dead id.
    await CoursePathwayLinkModel.deleteByPathwayId(id);
    await AssessmentPathwayLinkModel.deleteByPathwayId(id);
  },
};

module.exports = PathwayTemplateService;
