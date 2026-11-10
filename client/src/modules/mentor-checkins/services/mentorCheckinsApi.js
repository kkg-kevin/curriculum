import api, { checkDelete } from "../../../services/api";

// Parent–mentor check-ins (server/src/modules/mentor-checkins/).
const BASE = "/api/mentor-checkins";
const data = (r) => r.data.data;

export const mentorCheckinsApi = {
  // Templates — the same as QA's (qa/templateSources.js), managers only.
  templates: (params) => api.get(`${BASE}/templates`, { params }).then(data),
  template: (id) => api.get(`${BASE}/templates/${id}`).then(data),
  createTemplate: (body) => api.post(`${BASE}/templates`, body).then(data),
  updateTemplate: (id, body) => api.put(`${BASE}/templates/${id}`, body).then(data),
  setTemplateStatus: (id, status) => api.put(`${BASE}/templates/${id}/status`, { status }).then(data),
  deleteTemplate: (id) => api.delete(`${BASE}/templates/${id}`).then(data),
  checkDeleteTemplate: (id) => checkDelete(`${BASE}/templates/${id}`),

  // Setting a round up (managers).
  hubs: () => api.get(`${BASE}/hubs`).then(data),
  hubClasses: (hubId) => api.get(`${BASE}/hubs/${hubId}/classes`).then(data),
  classPeople: (classId) => api.get(`${BASE}/classes/${classId}/people`).then(data),
  preview: (body) => api.post(`${BASE}/rounds/preview`, body).then(data),

  rounds: (params) => api.get(`${BASE}/rounds`, { params }).then(data),
  round: (id) => api.get(`${BASE}/rounds/${id}`).then(data),
  createRound: (body) => api.post(`${BASE}/rounds`, body).then(data),
  updateRound: (id, body) => api.put(`${BASE}/rounds/${id}`, body).then(data),
  cancelRound: (id) => api.post(`${BASE}/rounds/${id}/cancel`).then(data),

  due: () => api.get(`${BASE}/due`).then(data),
  meetings: (params) => api.get(`${BASE}/meetings`, { params }).then(data),
  meeting: (id) => api.get(`${BASE}/meetings/${id}`).then(data),
  freeTimes: (id) => api.get(`${BASE}/meetings/${id}/free-times`).then(data),
  changeTime: (id, body) => api.put(`${BASE}/meetings/${id}/time`, body).then(data),
  confirm: (id) => api.post(`${BASE}/meetings/${id}/confirm`).then(data),
  cancelMeeting: (id) => api.post(`${BASE}/meetings/${id}/cancel`).then(data),
  setMissed: (id, missed) => api.post(`${BASE}/meetings/${id}/missed`, { missed }).then(data),
  saveReport: (id, body) => api.put(`${BASE}/meetings/${id}/report`, body).then(data),
  approve: (id, body) => api.post(`${BASE}/meetings/${id}/approve`, body).then(data),
};
