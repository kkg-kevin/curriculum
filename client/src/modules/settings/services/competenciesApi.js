import api from "../../../services/api";

const BASE = "/api/competencies";

export const competenciesApi = {
  /* Competencies */
  getCompetencies: () =>
    api.get(BASE).then((r) => r.data.data),

  createCompetency: (data) =>
    api.post(BASE, data).then((r) => r.data.data),

  updateCompetency: (id, data) =>
    api.put(`${BASE}/${id}`, data).then((r) => r.data.data),

  deleteCompetency: (id) =>
    api.delete(`${BASE}/${id}`).then((r) => r.data),

  /* Competency Indicators */
  getIndicators: (competencyId) =>
    api.get(`${BASE}/${competencyId}/indicators`).then((r) => r.data.data),

  createIndicator: (competencyId, data) =>
    api.post(`${BASE}/${competencyId}/indicators`, data).then((r) => r.data.data),

  updateIndicator: (competencyId, id, data) =>
    api.put(`${BASE}/${competencyId}/indicators/${id}`, data).then((r) => r.data.data),

  deleteIndicator: (competencyId, id) =>
    api.delete(`${BASE}/${competencyId}/indicators/${id}`).then((r) => r.data),
};
