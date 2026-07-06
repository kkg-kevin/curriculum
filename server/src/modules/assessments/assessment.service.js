const crypto = require("crypto");
const AssessmentModel = require("./assessment.model");
const AssessmentCompetencyLinkModel = require("./assessment-competency-link.model");
const CompetencyModel = require("../competencies/competency.model");
const AssessmentLearningAreaLinkModel = require("./assessment-learning-area-link.model");
const LearningAreaModel = require("../learning-areas/learning-area.model");

const generateId = () =>
  typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

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
    const assessment = AssessmentModel.findById(id);
    if (!assessment) {
      const err = new Error("Assessment not found");
      err.statusCode = 404;
      throw err;
    }
    return assessment;
  },

  async updateAssessment(id, data) {
    const existing = AssessmentModel.findById(id);
    if (!existing) {
      const err = new Error("Assessment not found");
      err.statusCode = 404;
      throw err;
    }
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

  async addItem(assessmentId, data) {
    const assessment = requireAssessment(assessmentId);
    const item = { ...data, id: generateId() };
    const items = [...(assessment.items || []), item];
    AssessmentModel.update(assessmentId, { items });
    return item;
  },

  async updateItem(assessmentId, itemId, data) {
    const assessment = requireAssessment(assessmentId);
    const items = assessment.items || [];
    const index = items.findIndex((i) => i.id === itemId);
    if (index === -1) {
      const err = new Error("Question not found");
      err.statusCode = 404;
      throw err;
    }
    const updated = { ...items[index], ...data, id: itemId };
    const nextItems = [...items];
    nextItems[index] = updated;
    AssessmentModel.update(assessmentId, { items: nextItems });
    return updated;
  },

  async deleteItem(assessmentId, itemId) {
    const assessment = requireAssessment(assessmentId);
    const items = assessment.items || [];
    if (!items.some((i) => i.id === itemId)) {
      const err = new Error("Question not found");
      err.statusCode = 404;
      throw err;
    }
    AssessmentModel.update(assessmentId, { items: items.filter((i) => i.id !== itemId) });
    return { message: "Question deleted successfully" };
  },

  async addRubricCriterion(assessmentId, data) {
    const assessment = requireAssessment(assessmentId);
    const criterion = { ...data, id: generateId() };
    const rubric = [...(assessment.rubric || []), criterion];
    AssessmentModel.update(assessmentId, { rubric });
    return criterion;
  },

  async updateRubricCriterion(assessmentId, criterionId, data) {
    const assessment = requireAssessment(assessmentId);
    const rubric = assessment.rubric || [];
    const index = rubric.findIndex((c) => c.id === criterionId);
    if (index === -1) {
      const err = new Error("Rubric criterion not found");
      err.statusCode = 404;
      throw err;
    }
    const updated = { ...rubric[index], ...data, id: criterionId };
    const nextRubric = [...rubric];
    nextRubric[index] = updated;
    AssessmentModel.update(assessmentId, { rubric: nextRubric });
    return updated;
  },

  async deleteRubricCriterion(assessmentId, criterionId) {
    const assessment = requireAssessment(assessmentId);
    const rubric = assessment.rubric || [];
    if (!rubric.some((c) => c.id === criterionId)) {
      const err = new Error("Rubric criterion not found");
      err.statusCode = 404;
      throw err;
    }
    AssessmentModel.update(assessmentId, { rubric: rubric.filter((c) => c.id !== criterionId) });
    return { message: "Rubric criterion deleted successfully" };
  },

  async addIndicator(assessmentId, data) {
    const assessment = requireAssessment(assessmentId);
    const indicator = { ...data, id: generateId() };
    const indicators = [...(assessment.indicators || []), indicator];
    AssessmentModel.update(assessmentId, { indicators });
    return indicator;
  },

  async updateIndicator(assessmentId, indicatorId, data) {
    const assessment = requireAssessment(assessmentId);
    const indicators = assessment.indicators || [];
    const index = indicators.findIndex((i) => i.id === indicatorId);
    if (index === -1) {
      const err = new Error("Indicator not found");
      err.statusCode = 404;
      throw err;
    }
    const updated = { ...indicators[index], ...data, id: indicatorId };
    const nextIndicators = [...indicators];
    nextIndicators[index] = updated;
    AssessmentModel.update(assessmentId, { indicators: nextIndicators });
    return updated;
  },

  async deleteIndicator(assessmentId, indicatorId) {
    const assessment = requireAssessment(assessmentId);
    const indicators = assessment.indicators || [];
    if (!indicators.some((i) => i.id === indicatorId)) {
      const err = new Error("Indicator not found");
      err.statusCode = 404;
      throw err;
    }
    AssessmentModel.update(assessmentId, { indicators: indicators.filter((i) => i.id !== indicatorId) });
    return { message: "Indicator deleted successfully" };
  },
};

module.exports = AssessmentService;
