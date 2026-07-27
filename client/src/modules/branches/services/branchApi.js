import api from "../../../services/api";

const ENDPOINT = "/api/branches";

export const branchApi = {
  create: (data) => api.post(ENDPOINT, data).then((r) => r.data.data),
  getAll: () => api.get(ENDPOINT).then((r) => r.data),
  getById: (id) => api.get(`${ENDPOINT}/${id}`).then((r) => r.data.data),
  // For a "branchAdmin" account — their own branch, resolved server-side off the caller's own
  // record rather than a client-supplied id.
  getMine: () => api.get(`${ENDPOINT}/mine`).then((r) => r.data.data),
  update: (id, data) => api.put(`${ENDPOINT}/${id}`, data).then((r) => r.data.data),
  remove: (id) => api.delete(`${ENDPOINT}/${id}`).then((r) => r.data),

  /* Branch admin — the one account delegated to manage every hub in this branch (admin-only) */
  assignAdmin: (id, data) => api.post(`${ENDPOINT}/${id}/admin`, data).then((r) => r.data.data),
  unassignAdmin: (id) => api.delete(`${ENDPOINT}/${id}/admin`).then((r) => r.data.data),
};
