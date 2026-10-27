import api from "../../../services/api";

// Hub check-ins (server/src/modules/checkins/). The check-ins list takes its filters as query
// params and answers { sessions, total, page, limit, counts, today }.
const BASE = "/api/checkins";
const data = (r) => r.data.data;

export const checkinsApi = {
  people: () => api.get(`${BASE}/people`).then(data),
  hubs: () => api.get(`${BASE}/hubs`).then(data),
  due: () => api.get(`${BASE}/due`).then(data),

  schedules: (params) => api.get(`${BASE}/schedules`, { params }).then(data),
  createSchedule: (body) => api.post(`${BASE}/schedules`, body).then(data),
  updateSchedule: (id, body) => api.put(`${BASE}/schedules/${id}`, body).then(data),
  endSchedule: (id) => api.post(`${BASE}/schedules/${id}/end`).then(data),

  sessions: (params) => api.get(`${BASE}/sessions`, { params }).then(data),
  session: (id) => api.get(`${BASE}/sessions/${id}`).then(data),
  saveReport: (id, report) => api.put(`${BASE}/sessions/${id}/report`, report).then(data),

  // Tasks from a check-in's resolutions. Adding, changing or removing one answers the check-in.
  tasks: (params) => api.get(`${BASE}/tasks`, { params }).then(data),
  createTask: (sessionId, body) => api.post(`${BASE}/sessions/${sessionId}/tasks`, body).then(data),
  updateTask: (id, body) => api.put(`${BASE}/tasks/${id}`, body).then(data),
  setTaskStatus: (id, status) => api.put(`${BASE}/tasks/${id}/status`, { status }).then(data),
  deleteTask: (id) => api.delete(`${BASE}/tasks/${id}`).then(data),
};
