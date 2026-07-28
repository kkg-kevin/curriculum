import api from "../../../services/api";

const BASE = "/api/reports";

export const reportApi = {
  getReadiness:  (classId, courseId) => api.get(`${BASE}/readiness`, { params: { classId, courseId } }).then((r) => r.data),
  generate:      (payload)           => api.post(BASE, payload).then((r) => r.data.data),
  listForClass:  (classId, courseId) => api.get(BASE, { params: { classId, courseId } }).then((r) => r.data),
  getById:       (id)                => api.get(`${BASE}/${id}`).then((r) => r.data.data),
  updateRemarks: (id, remarks)       => api.patch(`${BASE}/${id}`, { remarks }).then((r) => r.data.data),
  publish:       (id)                => api.post(`${BASE}/${id}/publish`).then((r) => r.data.data),
  getMine:       ()                  => api.get(`${BASE}/learner/mine`).then((r) => r.data),
};
