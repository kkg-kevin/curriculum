const CompetencyModel = require("./competency.model");
const CompetencyIndicatorModel = require("./competency-indicator.model");
const CurriculumCompetencyLinkModel = require("../curriculum/curriculum-competency-link.model");
const ProgressionLadderModel = require("../curriculum/progression-ladder.model");

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
    CompetencyIndicatorModel.deleteByCompetencyId(id);
    // Cross-module cleanup: this competency may be adopted by, and scheduled on the
    // progression ladder of, any number of curricula — strip it out everywhere.
    CurriculumCompetencyLinkModel.deleteByCompetencyId(id);
    ProgressionLadderModel.removeCompetencyFromAllRungs(id);
  },

  /* ── Competency Indicators ─────────────────────────────────────────── */

  getIndicators(competencyId) {
    const comp = CompetencyModel.findById(competencyId);
    if (!comp) {
      const err = new Error("Competency not found");
      err.statusCode = 404;
      throw err;
    }
    return CompetencyIndicatorModel.findByCompetencyId(competencyId);
  },

  createIndicator(competencyId, data) {
    const comp = CompetencyModel.findById(competencyId);
    if (!comp) {
      const err = new Error("Competency not found");
      err.statusCode = 404;
      throw err;
    }
    return CompetencyIndicatorModel.create({ competencyId, ...data });
  },

  updateIndicator(competencyId, id, data) {
    const comp = CompetencyModel.findById(competencyId);
    if (!comp) {
      const err = new Error("Competency not found");
      err.statusCode = 404;
      throw err;
    }
    const indicator = CompetencyIndicatorModel.findById(id);
    if (!indicator || indicator.competencyId !== competencyId) {
      const err = new Error("Competency indicator not found");
      err.statusCode = 404;
      throw err;
    }
    return CompetencyIndicatorModel.update(id, data);
  },

  deleteIndicator(competencyId, id) {
    const comp = CompetencyModel.findById(competencyId);
    if (!comp) {
      const err = new Error("Competency not found");
      err.statusCode = 404;
      throw err;
    }
    const indicator = CompetencyIndicatorModel.findById(id);
    if (!indicator || indicator.competencyId !== competencyId) {
      const err = new Error("Competency indicator not found");
      err.statusCode = 404;
      throw err;
    }
    CompetencyIndicatorModel.delete(id);
  },
};

module.exports = CompetencyService;
