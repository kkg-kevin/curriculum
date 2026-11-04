import api from "../../../../services/api";

const BASE = "/api/pathway-templates";

// The global, reusable Pathway library (Settings). A curriculum imports a copy of a template
// into itself — see the curriculum service's importPathway. Distinct from a curriculum's own
// pathways (competenciesApi.getPathways).
export const pathwayTemplatesApi = {
  getAll: () =>
    api.get(BASE).then((r) => r.data.data),

  // Settings → Pathways (read-only): the pathways the curricula use — per curriculum, its stages
  // and courses, learners on it — and the catalogue entries no curriculum uses.
  getDirectory: () =>
    api.get(`${BASE}/directory`).then((r) => r.data.data),

  // Whether the website shows a pathway, the hubs it runs at and its picture: { visible, hubIds, image }.
  setWebsite: (id, data) =>
    api.put(`${BASE}/${id}/website`, data).then((r) => r.data.data),


  create: (data) =>
    api.post(BASE, data).then((r) => r.data.data),

  update: (id, data) =>
    api.put(`${BASE}/${id}`, data).then((r) => r.data.data),

  remove: (id) =>
    api.delete(`${BASE}/${id}`).then((r) => r.data),
};
