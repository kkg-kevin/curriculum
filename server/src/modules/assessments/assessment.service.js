const AssessmentModel = require("./assessment.model");
const AssessmentCompetencyLinkModel = require("./assessment-competency-link.model");
const CurriculumService = require("../curriculum/curriculum.service");
const CompetencyModel = require("../settings/competencies/competency.model");
const AssessmentLearningAreaLinkModel = require("./assessment-learning-area-link.model");
const LearningAreaModel = require("../settings/learning-areas/learning-area.model");
const AssessmentInventoryLinkModel = require("./assessment-inventory-link.model");
const InventoryModel = require("../settings/inventory/inventory.model");

async function requireAssessment(id) {
  const assessment = await AssessmentModel.findById(id);
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
    await requireAssessment(id);
    return AssessmentModel.update(id, data);
  },

  async deleteAssessment(id) {
    const deleted = await AssessmentModel.delete(id);
    if (!deleted) {
      const err = new Error("Assessment not found");
      err.statusCode = 404;
      throw err;
    }
    await AssessmentCompetencyLinkModel.deleteByAssessmentId(id);
    await AssessmentLearningAreaLinkModel.deleteByAssessmentId(id);
    await AssessmentInventoryLinkModel.deleteByAssessmentId(id);
    return { message: "Assessment deleted successfully" };
  },

  /* ── Competencies (authored globally in Settings, tagged onto an assessment here) ── */

  async getAssessmentCompetencies(assessmentId) {
    const links = await AssessmentCompetencyLinkModel.findByAssessmentId(assessmentId);
    return CompetencyModel.findByIds(links.map((l) => l.competencyId));
  },

  async linkCompetency(assessmentId, competencyId) {
    await requireAssessment(assessmentId);
    const comp = await CompetencyModel.findById(competencyId);
    if (!comp) {
      const err = new Error("Competency not found");
      err.statusCode = 404;
      throw err;
    }
    await AssessmentCompetencyLinkModel.link(assessmentId, competencyId);
    // Live-sync: any curriculum containing a course whose session already has this
    // assessment attached picks up the new competency immediately, no re-attach needed.
    await CurriculumService.resyncCoursesForAssessment(assessmentId);
    return this.getAssessmentCompetencies(assessmentId);
  },

  async unlinkCompetency(assessmentId, competencyId) {
    await AssessmentCompetencyLinkModel.unlink(assessmentId, competencyId);
    return this.getAssessmentCompetencies(assessmentId);
  },

  /* ── Learning Areas (authored globally in Settings, tagged onto an assessment here) ── */

  async getAssessmentLearningAreas(assessmentId) {
    const links = await AssessmentLearningAreaLinkModel.findByAssessmentId(assessmentId);
    return LearningAreaModel.findByIds(links.map((l) => l.learningAreaId));
  },

  async linkLearningArea(assessmentId, learningAreaId) {
    await requireAssessment(assessmentId);
    const area = await LearningAreaModel.findById(learningAreaId);
    if (!area) {
      const err = new Error("Learning area not found");
      err.statusCode = 404;
      throw err;
    }
    await AssessmentLearningAreaLinkModel.link(assessmentId, learningAreaId);
    return this.getAssessmentLearningAreas(assessmentId);
  },

  async unlinkLearningArea(assessmentId, learningAreaId) {
    await AssessmentLearningAreaLinkModel.unlink(assessmentId, learningAreaId);
    return this.getAssessmentLearningAreas(assessmentId);
  },

  /* ── Inventory (authored globally in Settings, linked onto a project with a quantity) ── */

  async getAssessmentInventory(assessmentId) {
    const links = await AssessmentInventoryLinkModel.findByAssessmentId(assessmentId);
    const items = await InventoryModel.findByIds(links.map((l) => l.inventoryItemId));
    const itemsById = new Map(items.map((i) => [i.id, i]));
    return links
      .map((link) => {
        const item = itemsById.get(link.inventoryItemId);
        return item ? { ...item, quantity: link.quantity } : null;
      })
      .filter(Boolean);
  },

  async linkInventoryItem(assessmentId, inventoryItemId, quantity) {
    await requireAssessment(assessmentId);
    const item = await InventoryModel.findById(inventoryItemId);
    if (!item) {
      const err = new Error("Inventory item not found");
      err.statusCode = 404;
      throw err;
    }
    await AssessmentInventoryLinkModel.link(assessmentId, inventoryItemId, quantity);
    return this.getAssessmentInventory(assessmentId);
  },

  async unlinkInventoryItem(assessmentId, inventoryItemId) {
    await AssessmentInventoryLinkModel.unlink(assessmentId, inventoryItemId);
    return this.getAssessmentInventory(assessmentId);
  },
};

module.exports = AssessmentService;
