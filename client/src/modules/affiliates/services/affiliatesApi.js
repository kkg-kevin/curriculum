import api from "../../../services/api";

const BASE = "/api/affiliates";
const data = (r) => r.data.data;

// Affiliate marketing (server: modules/affiliates/). Admins: Affiliates page (Finance). Parents and
// educators: "Refer & earn" in their portal (/me); everyone else signs in as Affiliate
// (/affiliate-portal).
export const affiliatesApi = {
  // Admin
  list: () => api.get(BASE).then(data),
  create: (body) => api.post(BASE, body).then(data),
  // This workspace's people who already have a login (parents, educators, hub logins, staff) →
  // [{ userId, name, email, phone, kind, detail, alreadyAffiliate }].
  people: (q) => api.get(`${BASE}/people`, { params: { q } }).then(data),
  update: (id, body) => api.put(`${BASE}/${id}`, body).then(data),
  remove: (id) => api.delete(`${BASE}/${id}`).then(data),
  openInvoices: (id) => api.get(`${BASE}/${id}/open-invoices`).then(data),
  createPayout: (id) => api.post(`${BASE}/${id}/payouts`).then(data),
  // Emails an affiliate who signs in as Affiliate how to sign in (a set-password link, only ever to
  // them) → { sent, email }.
  sendSignInDetails: (id) => api.post(`${BASE}/${id}/sign-in-details`).then(data),
  referrals: (params = {}) => api.get(`${BASE}/referrals`, { params }).then(data),
  cancelReferral: (id, note) => api.post(`${BASE}/referrals/${id}/cancel`, { note }).then(data),
  commissions: (params = {}) => api.get(`${BASE}/commissions`, { params }).then(data),
  cancelCommission: (id, note) => api.post(`${BASE}/commissions/${id}/cancel`, { note }).then(data),
  payouts: (params = {}) => api.get(`${BASE}/payouts`, { params }).then(data),
  markPaid: (id, body) => api.post(`${BASE}/payouts/${id}/paid`, body).then(data),
  reject: (id, note) => api.post(`${BASE}/payouts/${id}/reject`, { note }).then(data),
  settings: () => api.get(`${BASE}/settings`).then(data),
  saveSettings: (body) => api.put(`${BASE}/settings`, body).then(data),

  // The affiliate's own
  mine: () => api.get(`${BASE}/me`).then(data),
  join: (body = {}) => api.post(`${BASE}/me/join`, body).then(data),
  updateMine: (body) => api.put(`${BASE}/me`, body).then(data),
  requestPayout: () => api.post(`${BASE}/me/payouts`).then(data),
};

export const PROGRAMMES = [
  ["home_learning", "Home Learning"],
  ["tech_club", "Tech Clubs"],
  ["pathway", "Pathways"],
  ["bootcamp", "Bootcamps"],
  ["shop", "Shop orders"],
];
export const RECURRING = new Set(["home_learning", "tech_club", "pathway"]);
export const METHOD_LABEL = { credit: "Invoice credit", mpesa: "M-Pesa", bank: "Bank", cash: "Cash" };
export const formatKsh = (n) => `KSh ${Number(n || 0).toLocaleString("en-KE", { maximumFractionDigits: 2 })}`;
export const formatDay = (d) => (d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—");
export const errorOf = (err, fallback = "Something went wrong") => err?.response?.data?.message || err?.message || fallback;
