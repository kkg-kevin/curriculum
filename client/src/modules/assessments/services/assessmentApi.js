import api from "../../../services/api";

const ENDPOINT = "/api/assessments";

export const assessmentApi = {
  create: (data) => api.post(ENDPOINT, data).then((r) => r.data.data),
  getAll: (params) => api.get(ENDPOINT, { params }).then((r) => r.data),
  getById: (id) => api.get(`${ENDPOINT}/${id}`).then((r) => r.data.data),
  update: (id, data) => api.put(`${ENDPOINT}/${id}`, data).then((r) => r.data.data),
  remove: (id) => api.delete(`${ENDPOINT}/${id}`).then((r) => r.data),

  /* Competencies — this assessment's tagged competencies (authored globally in Settings) */
  getAssessmentCompetencies: (assessmentId) =>
    api.get(`${ENDPOINT}/${assessmentId}/competencies/links`).then((r) => r.data.data),

  linkCompetency: (assessmentId, competencyId) =>
    api.post(`${ENDPOINT}/${assessmentId}/competencies/links`, { competencyId }).then((r) => r.data.data),

  unlinkCompetency: (assessmentId, competencyId) =>
    api.delete(`${ENDPOINT}/${assessmentId}/competencies/links/${competencyId}`).then((r) => r.data.data),

  /* Pathways — this assessment's tagged pathways (authored globally in Settings) */
  getAssessmentPathways: (assessmentId) =>
    api.get(`${ENDPOINT}/${assessmentId}/pathways/links`).then((r) => r.data.data),

  linkPathway: (assessmentId, pathwayId) =>
    api.post(`${ENDPOINT}/${assessmentId}/pathways/links`, { pathwayId }).then((r) => r.data.data),

  unlinkPathway: (assessmentId, pathwayId) =>
    api.delete(`${ENDPOINT}/${assessmentId}/pathways/links/${pathwayId}`).then((r) => r.data.data),

  /* Inventory — this project's linked materials, each with a quantity (authored globally in Settings) */
  getAssessmentInventory: (assessmentId) =>
    api.get(`${ENDPOINT}/${assessmentId}/inventory/links`).then((r) => r.data.data),

  linkInventoryItem: (assessmentId, inventoryItemId, quantity) =>
    api.post(`${ENDPOINT}/${assessmentId}/inventory/links`, { inventoryItemId, quantity }).then((r) => r.data.data),

  unlinkInventoryItem: (assessmentId, inventoryItemId) =>
    api.delete(`${ENDPOINT}/${assessmentId}/inventory/links/${inventoryItemId}`).then((r) => r.data.data),
};
