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
  // Every active household's due invoices raised now (the hourly run does the same).
  generateDueInvoices: () => api.post(`${BASE}/invoices`, {}).then((r) => r.data.data),
  // Website sign-ups: record the payment and activate the family, or decline the sign-up.
  approveSignup: (id, data) => api.post(`${BASE}/${id}/approve-payment`, data).then((r) => r.data.data),
  declineSignup: (id) => api.post(`${BASE}/${id}/decline-signup`, {}).then((r) => r.data.data),
  getForLearner: (learnerId) => api.get(`${BASE}/learner/${learnerId}`).then((r) => r.data.data),
  // Parent portal → My Family (the parent's own login): households, free places, add a child.
  getFamily: () => api.get(`${BASE}/family`).then((r) => r.data.data),
  addFamilyChild: (householdId, data) => api.post(`${BASE}/family/${householdId}/children`, data).then((r) => r.data.data),
  getMyAssignments: () => api.get(`${BASE}/educator`).then((r) => r.data.data),
};

// A package's prices, one per period it's offered for (server: home-learning.pricing.js's
// pricesOf) — a package saved before 6 Nov 2026 has just its one amount + billingPeriod.
const PERIOD_ORDER = ["daily", "weekly", "monthly", "quarterly", "annually"];
export function pricesOf(pkg) {
  if (!pkg) return [];
  const list = Array.isArray(pkg.periodPrices) && pkg.periodPrices.length
    ? pkg.periodPrices
    : [{ billingPeriod: pkg.billingPeriod || "monthly", amount: pkg.amount, extraChildAmount: pkg.extraChildAmount }];
  return [...list].sort((a, b) => PERIOD_ORDER.indexOf(a.billingPeriod) - PERIOD_ORDER.indexOf(b.billingPeriod));
}

// Mirrors the server's priceForPackage (home-learning.pricing.js) for the live price preview in
// the household forms — display only; the server always recalculates. `billingPeriod`: one of
// the package's periods (null = its default; one it doesn't offer falls back to the default).
export function priceForPackage(pkg, requested, billingPeriod = null) {
  if (!pkg) return null;
  const count = requested == null || requested === "" ? pkg.childrenIncluded : Number(requested);
  if (!Number.isInteger(count) || count < 1) return null;
  const prices = pricesOf(pkg);
  const entry = prices.find((p) => p.billingPeriod === billingPeriod) || prices.find((p) => p.billingPeriod === pkg.billingPeriod) || prices[0];
  if (!entry) return null;
  const amount = Number(entry.amount);
  if (count <= pkg.childrenIncluded) return { childCount: pkg.childrenIncluded, amount, billingPeriod: entry.billingPeriod };
  if (!pkg.allowExtraChildren || count > pkg.maxChildren) return null;
  return { childCount: count, amount: amount + (count - pkg.childrenIncluded) * (Number(entry.extraChildAmount) || 0), billingPeriod: entry.billingPeriod };
}

const PERIOD_LABEL = { daily: "Daily", weekly: "Weekly", monthly: "Monthly", quarterly: "Every 3 months", annually: "Yearly" };
export const periodLabel = (period) => PERIOD_LABEL[period] || period;
