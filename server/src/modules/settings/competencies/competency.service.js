const CompetencyModel = require("./competency.model");
const CurriculumCompetencyLinkModel = require("../../curriculum/competency-framework/curriculum-competency-link.model");
const CurriculumCompetencyIndicatorModel = require("../../curriculum/competency-framework/curriculum-competency-indicator.model");
const ProgressionLadderModel = require("../../curriculum/competency-framework/progression-ladder.model");
const PerformanceBandModel = require("../../curriculum/competency-framework/performance-band.model");
const CourseCompetencyLinkModel = require("../../courses/course-competency-link.model");
const AssessmentCompetencyLinkModel = require("../../assessments/assessment-competency-link.model");

const CompetencyService = {
  /* ── Competencies ───────────────────────────────────────────────────── */

  getCompetencies() {
    return CompetencyModel.findAll();
  },

  createCompetency(data) {
    return CompetencyModel.create(data);
  },

  updateCompetency(id, data) {
    const comp = CompetencyModel.findById(id);
    if (!comp) {
      const err = new Error("Competency not found");
      err.statusCode = 404;
      throw err;
    }
    return CompetencyModel.update(id, data);
  },

  deleteCompetency(id) {
    const comp = CompetencyModel.findById(id);
    if (!comp) {
      const err = new Error("Competency not found");
      err.statusCode = 404;
      throw err;
    }
    CompetencyModel.delete(id);
    // Cross-module cleanup: this competency may be adopted by, and scheduled on the
    // progression ladder of, any number of curricula, and tagged onto any number of
    // courses or assessments — strip it out everywhere.
    CurriculumCompetencyIndicatorModel.deleteByCompetencyId(id);
    CurriculumCompetencyLinkModel.deleteByCompetencyId(id);
    ProgressionLadderModel.removeCompetencyFromAllRungs(id);
    PerformanceBandModel.removeCompetencyFromAllBands(id);
    CourseCompetencyLinkModel.deleteByCompetencyId(id);
    AssessmentCompetencyLinkModel.deleteByCompetencyId(id);
  },
};

module.exports = CompetencyService;
