import api from "../../../services/api";

const BASE = "/api/home-learning";

export const homeLearningApi = {
  getAll: () => api.get(BASE).then((r) => r.data.data),
  // Read-only: the household forms pick from this. Packages are managed in Billing → Packages.
  getPackages: () => api.get(`${BASE}/packages`).then((r) => r.data.data),
  createHousehold: (data) => api.post(BASE, data).then((r) => r.data.data),
  updateHousehold: (id, data) => api.put(`${BASE}/${id}`, data).then((r) => r.data.data),
  enrollLearner: (id, data) => api.post(`${BASE}/${id}/learners`, data).then((r) => r.data.data),
  createLearner: (id, data) => api.post(`${BASE}/${id}/learners/new`, data).then((r) => r.data.data),
  removeLearner: (id, learnerId) => api.delete(`${BASE}/${id}/learners/${learnerId}`).then((r) => r.data.data),
  generateInvoice: (id, data) => api.post(`${BASE}/${id}/invoices`, data).then((r) => r.data.data),
  generateMonthlyInvoices: (data) => api.post(`${BASE}/invoices`, data).then((r) => r.data.data),
  // Website sign-ups: record the payment and activate the family, or decline the sign-up.
  approveSignup: (id, data) => api.post(`${BASE}/${id}/approve-payment`, data).then((r) => r.data.data),
  declineSignup: (id) => api.post(`${BASE}/${id}/decline-signup`, {}).then((r) => r.data.data),
  getForLearner: (learnerId) => api.get(`${BASE}/learner/${learnerId}`).then((r) => r.data.data),
  getMyAssignments: () => api.get(`${BASE}/educator`).then((r) => r.data.data),
};

// Mirrors the server's priceForPackage (home-learning.pricing.js) for the live price preview in
// the household forms — display only; the server always recalculates.
export function priceForPackage(pkg, requested) {
  if (!pkg) return null;
  const count = requested == null || requested === "" ? pkg.childrenIncluded : Number(requested);
  if (!Number.isInteger(count) || count < 1) return null;
  if (count <= pkg.childrenIncluded) return { childCount: pkg.childrenIncluded, monthlyAmount: pkg.monthlyAmount };
  if (!pkg.allowExtraChildren || count > pkg.maxChildren) return null;
  return { childCount: count, monthlyAmount: pkg.monthlyAmount + (count - pkg.childrenIncluded) * (pkg.extraChildAmount || 0) };
}
