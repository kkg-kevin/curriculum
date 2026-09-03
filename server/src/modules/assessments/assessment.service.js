const AssessmentModel = require("./assessment.model");
const AssessmentCompetencyLinkModel = require("./assessment-competency-link.model");
const CurriculumService = require("../curriculum/curriculum.service");
const CompetencyModel = require("../settings/competencies/competency.model");
const AssessmentPathwayLinkModel = require("./assessment-pathway-link.model");
const PathwayModel = require("../settings/pathways/pathway-template.model");
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
    await AssessmentPathwayLinkModel.deleteByAssessmentId(id);
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

  /* ── Pathways (authored globally in Settings, tagged onto an assessment here) ── */

  async getAssessmentPathways(assessmentId) {
    const links = await AssessmentPathwayLinkModel.findByAssessmentId(assessmentId);
    return PathwayModel.findByIds(links.map((l) => l.pathwayId));
  },

  async linkPathway(assessmentId, pathwayId) {
    await requireAssessment(assessmentId);
    const pathway = await PathwayModel.findById(pathwayId);
    if (!pathway) {
      const err = new Error("Pathway not found");
      err.statusCode = 404;
      throw err;
    }
    await AssessmentPathwayLinkModel.link(assessmentId, pathwayId);
    return this.getAssessmentPathways(assessmentId);
  },

  async unlinkPathway(assessmentId, pathwayId) {
    await AssessmentPathwayLinkModel.unlink(assessmentId, pathwayId);
    return this.getAssessmentPathways(assessmentId);
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
