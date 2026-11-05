import api from "../../../services/api";

// The educator performance profile (server: modules/educator-profiles/).
const BASE = "/api/educator-profiles";
const data = (r) => r.data.data;

export const educatorProfileApi = {
  // Internal: admins / staff, the supervisor, the hub (less), the educator (theirs). fresh → recount now.
  get: (teacherId, { fresh = false } = {}) => api.get(`${BASE}/${teacherId}`, { params: fresh ? { fresh: 1 } : {} }).then(data),
  mine: ({ fresh = false } = {}) => api.get(`${BASE}/me`, { params: fresh ? { fresh: 1 } : {} }).then(data),
  saveMine: (body) => api.put(`${BASE}/me`, body).then(data),
  review: (teacherId, body) => api.post(`${BASE}/${teacherId}/review`, body).then(data),
  handleRequest: (id) => api.patch(`${BASE}/requests/${id}`, {}).then(data),
  // Parents: Find a mentor, and asking for one.
  directory: () => api.get(`${BASE}/directory`).then(data),
  request: (teacherId, body) => api.post(`${BASE}/${teacherId}/requests`, body).then(data),
  // The share page (no sign-in).
  publicProfile: (slug) => api.get(`/api/public/educators/${encodeURIComponent(slug)}`).then(data),
};

// The share link of a published profile — the portal's own public page.
export const publicProfileUrl = (slug) => `${window.location.origin}/public/educators/${slug}`;
