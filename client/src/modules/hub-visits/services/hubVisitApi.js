import api from "../../../services/api";

const BASE = "/api/hub-visits";

export const hubVisitApi = {
  list: (params = {}) => api.get(BASE, { params }).then((r) => r.data),
  get: (id) => api.get(`${BASE}/${id}`).then((r) => r.data.data),
  logVisit: (data) => api.post(BASE, data).then((r) => r.data.data),
  update: (id, data) => api.patch(`${BASE}/${id}`, data).then((r) => r.data.data),
  remove: (id) => api.delete(`${BASE}/${id}`).then((r) => r.data.data),
  previewGenerateCharges: (hubId, data) => api.post(`${BASE}/hubs/${hubId}/generate-charges/preview`, data).then((r) => r.data.data),
  generateCharges: (hubId, data) => api.post(`${BASE}/hubs/${hubId}/generate-charges`, data).then((r) => r.data.data),
  getHubRevenueSummary: (hubId) => api.get(`${BASE}/hubs/${hubId}/revenue-summary`).then((r) => r.data.data),
  getAllHubsRevenueSummary: () => api.get(`${BASE}/revenue-summary`).then((r) => r.data),
};
