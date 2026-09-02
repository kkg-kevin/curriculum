import api from "../../../services/api";

const BASE = "/api/leads";

// Enquiries page — reads the leads table submitted by digifunzi-landing's Enroll/Contact forms
// (POST /api/public/leads, /api/public/contact — see server/src/modules/leads/lead.service.js).
export const leadApi = {
  getAll: (params) => api.get(BASE, { params }).then((r) => r.data.data),
  updateStatus: (id, status) => api.patch(`${BASE}/${id}/status`, { status }).then((r) => r.data.data),
};
