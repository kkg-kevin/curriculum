import api from "../../../../services/api";

const BASE = "/api/access";

// Staff roles (owner-only — see server/src/modules/access/). A role is a named set of
// permissions, { moduleKey: ["view","create","edit","delete"] }, assigned to staff accounts.
export const accessApi = {
  modules: () => api.get(`${BASE}/modules`).then((r) => r.data.data),
  roles: () => api.get(`${BASE}/roles`).then((r) => r.data.data),
  createRole: (data) => api.post(`${BASE}/roles`, data).then((r) => r.data.data),
  updateRole: (id, data) => api.put(`${BASE}/roles/${id}`, data).then((r) => r.data.data),
  deleteRole: (id) => api.delete(`${BASE}/roles/${id}`).then((r) => r.data),
};
