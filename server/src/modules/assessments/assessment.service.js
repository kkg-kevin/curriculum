const crypto = require("crypto");
const AssessmentModel = require("./assessment.model");

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
    return { message: "Assessment deleted successfully" };
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
};

module.exports = AssessmentService;
