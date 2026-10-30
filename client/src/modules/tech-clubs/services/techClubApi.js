import api from "../../../services/api";

const BASE = "/api/tech-clubs";

// Estate Tech Club memberships (see server/src/modules/tech-clubs). Packages are created and
// priced in Billing → Packages; this only reads them.
export const techClubApi = {
  getAll: (hubId) => api.get(BASE, { params: hubId ? { hubId } : {} }).then((r) => r.data.data),
  // The admin's clubs (non-school learning hubs), each with its classes — the filter and "Place child".
  getClubs: () => api.get(`${BASE}/clubs`).then((r) => r.data.data),
  getPackages: () => api.get(`${BASE}/packages`).then((r) => r.data.data),
  updateMembership: (id, data) => api.put(`${BASE}/${id}`, data).then((r) => r.data.data),
  placeChild: (id, learnerId, classId) => api.put(`${BASE}/${id}/children/${learnerId}`, { classId }).then((r) => r.data.data),
  removeChild: (id, learnerId) => api.delete(`${BASE}/${id}/children/${learnerId}`).then((r) => r.data.data),
  restoreChild: (id, learnerId) => api.post(`${BASE}/${id}/children/${learnerId}/restore`, {}).then((r) => r.data.data),
  generateInvoice: (id, data) => api.post(`${BASE}/${id}/invoices`, data).then((r) => r.data.data),
  // Every active membership's due invoices (optionally at one club) raised now.
  generateDueInvoices: (data) => api.post(`${BASE}/invoices`, data).then((r) => r.data.data),
  // Website sign-ups: record the payment and activate the family, or decline the sign-up.
  approveSignup: (id, data) => api.post(`${BASE}/${id}/approve-payment`, data).then((r) => r.data.data),
  declineSignup: (id) => api.post(`${BASE}/${id}/decline-signup`, {}).then((r) => r.data.data),
  // Parent portal → My Family (the parent's own login): memberships, free places, add a child.
  getFamily: () => api.get(`${BASE}/family`).then((r) => r.data.data),
  addFamilyChild: (membershipId, data) => api.post(`${BASE}/family/${membershipId}/children`, data).then((r) => r.data.data),
};
