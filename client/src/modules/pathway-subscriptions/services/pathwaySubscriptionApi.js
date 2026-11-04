import api from "../../../services/api";

const BASE = "/api/pathway-subscriptions";
const data = (r) => r.data.data;

// Website pathways sold by subscription (server: modules/pathway-subscriptions/). Plans are managed
// in Billing → Packages → Pathways; subscriptions on the Pathway subscriptions page; a learner's
// pathway access shows on My Courses; a parent renews from their portal.
export const pathwaySubscriptionApi = {
  // Plans
  listPackages: (pathwayTemplateId) => api.get(`${BASE}/packages`, { params: pathwayTemplateId ? { pathwayTemplateId } : {} }).then(data),
  createPackage: (body) => api.post(`${BASE}/packages`, body).then(data),
  updatePackage: (id, body) => api.put(`${BASE}/packages/${id}`, body).then(data),
  deletePackage: (id) => api.delete(`${BASE}/packages/${id}`).then(data),

  // Subscriptions (staff)
  list: (params = {}) => api.get(BASE, { params }).then(data),
  get: (id) => api.get(`${BASE}/${id}`).then(data),
  setStatus: (id, status) => api.patch(`${BASE}/${id}/status`, { status }).then(data),
  changePlan: (id, packageId) => api.put(`${BASE}/${id}/plan`, { packageId }).then(data),
  invoiceNext: (id) => api.post(`${BASE}/${id}/invoices`).then(data),
  invoiceDue: () => api.post(`${BASE}/invoices`).then(data),

  // The learner (or a parent viewing a child): pathways they may open, with their courses.
  myAccess: () => api.get(`${BASE}/access`).then(data),
  // A parent's own subscriptions, and Renew.
  mine: () => api.get(`${BASE}/mine`).then(data),
  renewMine: (id) => api.post(`${BASE}/mine/${id}/renew`).then(data),
};
