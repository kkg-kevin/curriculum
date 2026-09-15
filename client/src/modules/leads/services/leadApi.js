import api from "../../../services/api";

const BASE = "/api/leads";

// Enquiries page — reads the leads table submitted by digifunzi-landing's Enroll/Contact forms
// (POST /api/public/leads, /api/public/contact — see server/src/modules/leads/lead.service.js).
export const leadApi = {
  getAll: (params) => api.get(BASE, { params }).then((r) => r.data.data),
  updateStatus: (id, status) => api.patch(`${BASE}/${id}/status`, { status }).then((r) => r.data.data),
  getTimeline: (id) => api.get(`${BASE}/${id}/timeline`).then((r) => r.data.data),
  reply: (id, { subject, body }) => api.post(`${BASE}/${id}/reply`, { subject, body }).then((r) => r.data),
  addNote: (id, body) => api.post(`${BASE}/${id}/notes`, { body }).then((r) => r.data.data),
  // A bootcamp-enrollment lead (source: "enroll", already has a provisioned learnerId) — records
  // a manually-received cash payment and unlocks that learner's account (see
  // bootcamp-enrollment.service.js's markLeadPaid).
  markPaid: (id, data) => api.post(`${BASE}/${id}/mark-paid`, data).then((r) => r.data.data),
};
