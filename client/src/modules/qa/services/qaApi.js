import api, { checkDelete } from "../../../services/api";

// Quality assurance (server/src/modules/qa/). The visits list takes its filters as query params
// and answers { visits, total, page, limit, counts, today }.
const BASE = "/api/qa";
const data = (r) => r.data.data;

export const qaApi = {
  templates: (params) => api.get(`${BASE}/templates`, { params }).then(data),
  template: (id) => api.get(`${BASE}/templates/${id}`).then(data),
  createTemplate: (body) => api.post(`${BASE}/templates`, body).then(data),
  updateTemplate: (id, body) => api.put(`${BASE}/templates/${id}`, body).then(data),
  setTemplateStatus: (id, status) => api.put(`${BASE}/templates/${id}/status`, { status }).then(data),
  deleteTemplate: (id) => api.delete(`${BASE}/templates/${id}`).then(data),
  checkDeleteTemplate: (id) => checkDelete(`${BASE}/templates/${id}`),

  educators: () => api.get(`${BASE}/educators`).then(data),
  reviewers: () => api.get(`${BASE}/reviewers`).then(data),

  schedules: (params) => api.get(`${BASE}/schedules`, { params }).then(data),
  createSchedule: (body) => api.post(`${BASE}/schedules`, body).then(data),
  updateSchedule: (id, body) => api.put(`${BASE}/schedules/${id}`, body).then(data),
  endSchedule: (id) => api.post(`${BASE}/schedules/${id}/end`).then(data),

  visits: (params) => api.get(`${BASE}/visits`, { params }).then(data),
  visit: (id) => api.get(`${BASE}/visits/${id}`).then(data),
  createVisit: (body) => api.post(`${BASE}/visits`, body).then(data),
  updateVisit: (id, body) => api.put(`${BASE}/visits/${id}`, body).then(data),
  cancelVisit: (id) => api.post(`${BASE}/visits/${id}/cancel`).then(data),
  saveReview: (id, body) => api.put(`${BASE}/visits/${id}/review`, body).then(data),
  saveReply: (id, reply) => api.put(`${BASE}/visits/${id}/reply`, { reply }).then(data),
};
