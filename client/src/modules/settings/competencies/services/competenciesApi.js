import api from "../../../../services/api";

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
};
