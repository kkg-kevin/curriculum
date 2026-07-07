const AssessmentModel = require("./assessment.model");
const AssessmentCompetencyLinkModel = require("./assessment-competency-link.model");
const CompetencyModel = require("../settings/competencies/competency.model");
const AssessmentLearningAreaLinkModel = require("./assessment-learning-area-link.model");
const LearningAreaModel = require("../settings/learning-areas/learning-area.model");

function requireAssessment(id) {
  const assessment = AssessmentModel.findById(id);
  if (!assessment) {
    const err = new Error("Assessment not found");
    err.statusCode = 404;
    throw err;
  }
  return assessment;
}

const AssessmentService = {
  async createAssessment(data) {
    return AssessmentModel.create(data);
  },

  async getAllAssessments(filters) {
    return AssessmentModel.findAll(filters);
  },

  async getAssessmentById(id) {
    return requireAssessment(id);
  },

  async updateAssessment(id, data) {
    requireAssessment(id);
    return AssessmentModel.update(id, data);
  },

  async deleteAssessment(id) {
    const deleted = AssessmentModel.delete(id);
    if (!deleted) {
      const err = new Error("Assessment not found");
      err.statusCode = 404;
      throw err;
    }
    AssessmentCompetencyLinkModel.deleteByAssessmentId(id);
    AssessmentLearningAreaLinkModel.deleteByAssessmentId(id);
    return { message: "Assessment deleted successfully" };
  },

  /* ── Competencies (authored globally in Settings, tagged onto an assessment here) ── */

  async getAssessmentCompetencies(assessmentId) {
    const links = AssessmentCompetencyLinkModel.findByAssessmentId(assessmentId);
    return CompetencyModel.findByIds(links.map((l) => l.competencyId));
  },

  async linkCompetency(assessmentId, competencyId) {
    requireAssessment(assessmentId);
    const comp = CompetencyModel.findById(competencyId);
    if (!comp) {
      const err = new Error("Competency not found");
      err.statusCode = 404;
      throw err;
    }
    AssessmentCompetencyLinkModel.link(assessmentId, competencyId);
    return this.getAssessmentCompetencies(assessmentId);
  },

  async unlinkCompetency(assessmentId, competencyId) {
    AssessmentCompetencyLinkModel.unlink(assessmentId, competencyId);
    return this.getAssessmentCompetencies(assessmentId);
  },

  /* ── Learning Areas (authored globally in Settings, tagged onto an assessment here) ── */

  async getAssessmentLearningAreas(assessmentId) {
    const links = AssessmentLearningAreaLinkModel.findByAssessmentId(assessmentId);
    return LearningAreaModel.findByIds(links.map((l) => l.learningAreaId));
  },

  async linkLearningArea(assessmentId, learningAreaId) {
    requireAssessment(assessmentId);
    const area = LearningAreaModel.findById(learningAreaId);
    if (!area) {
      const err = new Error("Learning area not found");
      err.statusCode = 404;
      throw err;
    }
    AssessmentLearningAreaLinkModel.link(assessmentId, learningAreaId);
    return this.getAssessmentLearningAreas(assessmentId);
  },

  async unlinkLearningArea(assessmentId, learningAreaId) {
    AssessmentLearningAreaLinkModel.unlink(assessmentId, learningAreaId);
    return this.getAssessmentLearningAreas(assessmentId);
  },
};

module.exports = AssessmentService;
