import api from "../../../services/api";

const BASE = "/api/claims";

// Educator claims (server/src/modules/claims/): an educator requests payment for a course they
// teach — an advance or the full amount — and it goes to a supervisor, then the admin.
export const claimsApi = {
  // Educator: { currency, summary, courses } — every course they teach and what each is worth.
  getMyCourses: () => api.get(`${BASE}/courses`).then((r) => r.data.data),
  // Educator: one course in full — figures, per-session student records, and its claims.
  // Reads every student's work for every session, so it gets a longer timeout than usual.
  getMyCourse: (classId, courseId) => api.get(`${BASE}/courses/${classId}/${courseId}`, { timeout: 45000 }).then((r) => r.data.data),
  submit: (data) => api.post(BASE, data).then((r) => r.data.data),
  withdraw: (id) => api.delete(`${BASE}/${id}`).then((r) => r.data),

  // Reviewers: { claims, counts, amounts } for the workspace.
  list: (params) => api.get(BASE, { params }).then((r) => r.data.data),
  // Reviewers: a claim plus the course's records as they stand now (`course`, null if it's gone).
  // Same long read as getMyCourse.
  getById: (id) => api.get(`${BASE}/${id}`, { timeout: 45000 }).then((r) => r.data.data),
  supervisorDecision: (id, data) => api.post(`${BASE}/${id}/supervisor-decision`, data).then((r) => r.data.data),
  adminDecision: (id, data) => api.post(`${BASE}/${id}/admin-decision`, data).then((r) => r.data.data),
  markPaid: (id, data) => api.post(`${BASE}/${id}/mark-paid`, data).then((r) => r.data.data),

  getSettings: () => api.get(`${BASE}/settings`).then((r) => r.data.data),
  updateSettings: (data) => api.put(`${BASE}/settings`, data).then((r) => r.data.data),
};
