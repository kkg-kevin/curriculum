import api from "../../../services/api";

// The supervisor portal's own endpoints (server: modules/supervisor-portal/), limited to the
// supervisor's educators.
const BASE = "/api/supervisor-portal";
const clean = (params = {}) => Object.fromEntries(Object.entries(params).filter(([, v]) => v !== "" && v != null));

export const supervisorPortalApi = {
  // My Profile: their account, who manages it, their work in figures.
  me: () => api.get(`${BASE}/me`).then((r) => r.data.data),
  educator: (id) => api.get(`${BASE}/educators/${id}`).then((r) => r.data.data),
  activity: (params) => api.get(`${BASE}/activity`, { params: clean(params) }).then((r) => r.data.data),
  // { teacherIds?, title?, message } → { sent: [names], notReached: [names] }
  message: (body) => api.post(`${BASE}/messages`, body).then((r) => r.data.data),
};
