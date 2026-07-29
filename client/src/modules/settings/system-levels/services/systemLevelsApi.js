import api from "../../../../services/api";

const BASE = "/api/system-levels";

export const systemLevelsApi = {
  getSystemLevels: () =>
    api.get(BASE).then((r) => r.data.data),

  createSystemLevel: (data) =>
    api.post(BASE, data).then((r) => r.data.data),

  updateSystemLevel: (id, data) =>
    api.put(`${BASE}/${id}`, data).then((r) => r.data.data),

  deleteSystemLevel: (id) =>
    api.delete(`${BASE}/${id}`).then((r) => r.data),

  reorderSystemLevels: (orderedIds) =>
    api.post(`${BASE}/reorder`, { orderedIds }).then((r) => r.data.data),
};
