const CompetencyModel = require("./competency.model");
const CurriculumCompetencyLinkModel = require("../../curriculum/curriculum-competency-link.model");
const CurriculumCompetencyIndicatorModel = require("../../curriculum/curriculum-competency-indicator.model");
const ProgressionLadderModel = require("../../curriculum/progression-ladder.model");
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
    CourseCompetencyLinkModel.deleteByCompetencyId(id);
    AssessmentCompetencyLinkModel.deleteByCompetencyId(id);
  },
};

module.exports = CompetencyService;
