import api from "../../../services/api";

const BASE = "/api/mentor-sessions";

export const mentorSessionApi = {
  create:  (data)     => api.post(BASE, data).then((r) => r.data.data),
  getAll:  (params)   => api.get(BASE, { params }).then((r) => r.data.data),
  getById: (id)       => api.get(`${BASE}/${id}`).then((r) => r.data.data),
  update:  (id, data) => api.put(`${BASE}/${id}`, data).then((r) => r.data.data),
  remove:  (id)       => api.delete(`${BASE}/${id}`).then((r) => r.data),

  // Derived revenue rollup for one hub — paid/unpaid/waived totals plus the underlying sessions.
  getHubRevenue: (hubId) => api.get(`${BASE}/hub-revenue/${hubId}`).then((r) => r.data.data),
};
