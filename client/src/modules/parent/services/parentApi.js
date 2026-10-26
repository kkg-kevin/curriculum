import api from "../../../services/api";

const BASE = "/api/parent";

export const parentApi = {
  overview: () => api.get(`${BASE}/overview`).then((r) => r.data.data),
  timetable: (from, to) => api.get(`${BASE}/timetable`, { params: { from, to } }).then((r) => r.data),
  childLogin: (childId) => api.get(`${BASE}/children/${childId}/login`).then((r) => r.data.data),
  setChildLogin: (childId, data) => api.put(`${BASE}/children/${childId}/login`, data).then((r) => r.data.data),
};
