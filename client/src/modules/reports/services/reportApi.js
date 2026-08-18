import api from "../../../services/api";

const BASE = "/api/reports";

export const reportApi = {
  getReadiness:  (classId, courseId) => api.get(`${BASE}/readiness`, { params: { classId, courseId } }).then((r) => r.data),
  getHubAnalytics: (hubId, days, gender) => api.get(`${BASE}/hub-analytics`, { params: { hubId, days, gender: gender || undefined } }).then((r) => r.data.data),
  getPlatformAnalytics: (days)       => api.get(`${BASE}/platform-analytics`, { params: { days } }).then((r) => r.data.data),
  // Batched form — one request covers every course in a class, returning { [courseId]: rows }.
  getReadinessBatch: (classId, courseIds) =>
    api.get(`${BASE}/readiness`, { params: { classId, courseIds: courseIds.join(",") } }).then((r) => r.data),
  generate:      (payload)           => api.post(BASE, payload).then((r) => r.data.data),
  listForClass:  (classId, courseId) => api.get(BASE, { params: { classId, courseId } }).then((r) => r.data),
  getById:       (id)                => api.get(`${BASE}/${id}`).then((r) => r.data.data),
  updateRemarks: (id, remarks)       => api.patch(`${BASE}/${id}`, { remarks }).then((r) => r.data.data),
  publish:       (id)                => api.post(`${BASE}/${id}/publish`).then((r) => r.data.data),
  unpublish:     (id)                => api.post(`${BASE}/${id}/unpublish`).then((r) => r.data.data),
  // hubId scopes to the hub the portal switcher is on; omitted returns every hub's reports.
  getMine:       (hubId)             => api.get(`${BASE}/learner/mine`, { params: hubId ? { hubId } : {} }).then((r) => r.data),
};
