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

  // Prospects (19 Nov 2026): families an affiliate pre-registers — theirs while the claim is open.
  myProspects: () => api.get(`${BASE}/me/prospects`).then(data),
  addProspect: (body) => api.post(`${BASE}/me/prospects`, body).then(data),
  addProspects: (rows) => api.post(`${BASE}/me/prospects/bulk`, { consent: true, rows }).then(data),
  updateProspect: (id, body) => api.put(`${BASE}/me/prospects/${id}`, body).then(data),
  releaseProspect: (id) => api.post(`${BASE}/me/prospects/${id}/release`).then(data),
  inviteProspect: (id, channel) => api.post(`${BASE}/me/prospects/${id}/invite`, { channel }).then(data),
  // Admin
  prospects: (params = {}) => api.get(`${BASE}/prospects`, { params }).then(data),
  addProspectFor: (body) => api.post(`${BASE}/prospects`, body).then(data),
  adminReleaseProspect: (id) => api.post(`${BASE}/prospects/${id}/release`).then(data),
  reassignProspect: (id, affiliateId) => api.post(`${BASE}/prospects/${id}/reassign`, { affiliateId }).then(data),
  decideMatch: (id, approve) => api.post(`${BASE}/prospects/${id}/match`, { approve }).then(data),
  // One prospect's page (24 Nov 2026): details, the team's follow-up notes, a follow-up date.
  prospect: (id) => api.get(`${BASE}/prospects/${id}`).then(data),
  addProspectNote: (id, body) => api.post(`${BASE}/prospects/${id}/notes`, { body }).then(data),
  deleteProspectNote: (id, noteId) => api.delete(`${BASE}/prospects/${id}/notes/${noteId}`).then(data),
  setProspectFollowUp: (id, date) => api.put(`${BASE}/prospects/${id}/follow-up`, { date }).then(data),
  // The family's "no thanks" link (no sign-in).
  optOut: (token) => api.post(`/api/public/affiliate-prospects/opt-out/${token}`).then(data),
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
