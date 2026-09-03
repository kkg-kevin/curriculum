import api from "../../../../services/api";

const BASE = "/api/pathway-templates";

// The global, reusable Pathway library (Settings). A curriculum imports a copy of a template
// into itself — see the curriculum service's importPathway. Distinct from a curriculum's own
// pathways (competenciesApi.getPathways).
export const pathwayTemplatesApi = {
  getAll: () =>
    api.get(BASE).then((r) => r.data.data),

  create: (data) =>
    api.post(BASE, data).then((r) => r.data.data),

  update: (id, data) =>
    api.put(`${BASE}/${id}`, data).then((r) => r.data.data),

  remove: (id) =>
    api.delete(`${BASE}/${id}`).then((r) => r.data),
};
