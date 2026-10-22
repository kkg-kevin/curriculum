import api from "../../../services/api";

const BASE = "/api/claims";

// Educator claims (server/src/modules/claims/): an educator requests payment for a course they
// teach — an advance or the full amount. Their supervisor approves it and the admin pays; with
// no supervisor it goes straight to the admin.
export const claimsApi = {
  // Educator: { currency, summary, courses } — every course they teach and what each is worth.
  getMyCourses: (params) => api.get(`${BASE}/courses`, { params }).then((r) => r.data.data),
  // Educator: one course in full — figures, per-session student records, and its claims.
  // Reads every student's work for every session, so it gets a longer timeout than usual.
  getMyCourse: (classId, courseId) => api.get(`${BASE}/courses/${classId}/${courseId}`, { timeout: 45000 }).then((r) => r.data.data),
  submit: (data) => api.post(BASE, data).then((r) => r.data.data),
  withdraw: (id) => api.delete(`${BASE}/${id}`).then((r) => r.data),

  // Reviewers: { claims, counts, amounts } — the workspace's claims, or for a supervisor the
  // ones sent to them.
  list: (params) => api.get(BASE, { params }).then((r) => r.data.data),
  // Reviewers: a claim plus the course's records as they stand now (`course`, null if it's gone).
  // Same long read as getMyCourse.
  getById: (id) => api.get(`${BASE}/${id}`, { timeout: 45000 }).then((r) => r.data.data),
  supervisorDecision: (id, data) => api.post(`${BASE}/${id}/supervisor-decision`, data).then((r) => r.data.data),
  adminDecision: (id, data) => api.post(`${BASE}/${id}/admin-decision`, data).then((r) => r.data.data),
  markPaid: (id, data) => api.post(`${BASE}/${id}/mark-paid`, data).then((r) => r.data.data),
  // Paying an approved claim by M-Pesa (B2C): { canPayOut, phone, payouts } and sending one.
  // The claim becomes paid when M-Pesa confirms the money went.
  mpesaPayouts: (id) => api.get(`${BASE}/${id}/mpesa-payouts`).then((r) => r.data.data),
  payByMpesa: (id, data) => api.post(`${BASE}/${id}/mpesa-payout`, data).then((r) => r.data.data),

  // Supervisor accounts — logins that only review claims. [{ id, name, email, educators }]
  listSupervisors: () => api.get(`${BASE}/supervisors`).then((r) => r.data.data),
  createSupervisor: (data) => api.post(`${BASE}/supervisors`, data).then((r) => r.data.data),
  updateSupervisor: (id, data) => api.put(`${BASE}/supervisors/${id}`, data).then((r) => r.data.data),
  removeSupervisor: (id) => api.delete(`${BASE}/supervisors/${id}`).then((r) => r.data),

  getSettings: () => api.get(`${BASE}/settings`).then((r) => r.data.data),
  updateSettings: (data) => api.put(`${BASE}/settings`, data).then((r) => r.data.data),
};
