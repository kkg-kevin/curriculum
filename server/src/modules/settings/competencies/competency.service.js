const CompetencyModel = require("./competency.model");
const CurriculumCompetencyLinkModel = require("../../curriculum/competency-framework/curriculum-competency-link.model");
const CurriculumCompetencyIndicatorModel = require("../../curriculum/competency-framework/curriculum-competency-indicator.model");
const ProgressionLadderModel = require("../../curriculum/competency-framework/progression-ladder.model");
const PerformanceBandModel = require("../../curriculum/competency-framework/performance-band.model");
const AgeCategoryModel = require("../../curriculum/competency-framework/age-category.model");
const CourseCompetencyLinkModel = require("../../courses/course-competency-link.model");
const AssessmentCompetencyLinkModel = require("../../assessments/assessment-competency-link.model");

const CompetencyService = {
  /* ── Competencies ───────────────────────────────────────────────────── */

  async getCompetencies() {
    return CompetencyModel.findAll();
  },

  async createCompetency(data) {
    return CompetencyModel.create(data);
  },

  async updateCompetency(id, data) {
    const comp = await CompetencyModel.findById(id);
    if (!comp) {
      const err = new Error("Competency not found");
      err.statusCode = 404;
      throw err;
    }
    return CompetencyModel.update(id, data);
  },

  async deleteCompetency(id) {
    const comp = await CompetencyModel.findById(id);
    if (!comp) {
      const err = new Error("Competency not found");
      err.statusCode = 404;
      throw err;
    }
    await CompetencyModel.delete(id);
    // Cross-module cleanup: this competency may be adopted by, and scheduled on the
    // progression ladder of, any number of curricula, and tagged onto any number of
    // courses or assessments — strip it out everywhere.
    await CurriculumCompetencyIndicatorModel.deleteByCompetencyId(id);
    await CurriculumCompetencyLinkModel.deleteByCompetencyId(id);
    await ProgressionLadderModel.removeCompetencyFromAllRungs(id);
    await PerformanceBandModel.removeCompetencyFromAllBands(id);
    await AgeCategoryModel.removeCompetencyFromAllStages(id);
    await CourseCompetencyLinkModel.deleteByCompetencyId(id);
    await AssessmentCompetencyLinkModel.deleteByCompetencyId(id);
  },
};

module.exports = CompetencyService;
