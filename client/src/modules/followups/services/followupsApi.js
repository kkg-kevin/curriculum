import api from "../../../services/api";

// Learner follow-up cases (26 Nov 2026 — server modules/analytics/analytics.cases.js).
const data = (r) => r.data.data;
const clean = (o) => Object.fromEntries(Object.entries(o || {}).filter(([, v]) => v !== "" && v != null));

export const followupsApi = {
  list: (params) => api.get("/api/followups/cases", { params: clean(params) }).then(data),
  get: (id) => api.get(`/api/followups/cases/${id}`).then(data),
  act: (id, body) => api.post(`/api/followups/cases/${id}/actions`, body).then(data),
  open: (body) => api.post("/api/followups/cases", body).then(data),
};

export const errorOf = (err, fallback = "Something went wrong") => err?.response?.data?.message || err?.message || fallback;
export const day = (d) => (d ? new Date(`${String(d).slice(0, 10)}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "");
export const when = (d) => (d ? new Date(d).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "");
