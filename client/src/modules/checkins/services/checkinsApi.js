import api from "../../../services/api";

// Hub check-ins (server/src/modules/checkins/). Lists take their filters as query params and
// answer { rows…, total, page, limit }.
const BASE = "/api/checkins";
const data = (r) => r.data.data;

export const checkinsApi = {
  people: () => api.get(`${BASE}/people`).then(data),
  hubs: () => api.get(`${BASE}/hubs`).then(data),
  overview: (params) => api.get(`${BASE}/overview`, { params }).then(data),

  schedules: (params) => api.get(`${BASE}/schedules`, { params }).then(data),
  createSchedule: (body) => api.post(`${BASE}/schedules`, body).then(data),
  updateSchedule: (id, body) => api.put(`${BASE}/schedules/${id}`, body).then(data),
  endSchedule: (id, reason) => api.post(`${BASE}/schedules/${id}/end`, { reason }).then(data),

  sessions: (params) => api.get(`${BASE}/sessions`, { params }).then(data),
  session: (id) => api.get(`${BASE}/sessions/${id}`).then(data),
  saveReport: (id, report) => api.put(`${BASE}/sessions/${id}/report`, report).then(data),
  submitReport: (id) => api.post(`${BASE}/sessions/${id}/submit`).then(data),
  reopenReport: (id, reason) => api.post(`${BASE}/sessions/${id}/reopen`, { reason }).then(data),
  reschedule: (id, body) => api.post(`${BASE}/sessions/${id}/reschedule`, body).then(data),
  cancel: (id, reason) => api.post(`${BASE}/sessions/${id}/cancel`, { reason }).then(data),

  actions: (params) => api.get(`${BASE}/actions`, { params }).then(data),
  action: (id) => api.get(`${BASE}/actions/${id}`).then(data),
  createAction: (sessionId, body) => api.post(`${BASE}/sessions/${sessionId}/actions`, body).then(data),
  updateAction: (id, body) => api.put(`${BASE}/actions/${id}`, body).then(data),
  setActionStatus: (id, body) => api.post(`${BASE}/actions/${id}/status`, body).then(data),
  addActionNote: (id, note) => api.post(`${BASE}/actions/${id}/notes`, { note }).then(data),
  escalateAction: (id, note) => api.post(`${BASE}/actions/${id}/escalate`, { note }).then(data),
  deleteAction: (id) => api.delete(`${BASE}/actions/${id}`).then(data),
};
