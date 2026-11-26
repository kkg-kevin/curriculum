import api from "../../../services/api";

// Connect → Announcements (26 Nov 2026 — server modules/connect/connect.announcements.js).
//   Reading: /api/announcements — what reached the signed-in person.
//   Writing (the team): /api/connect/admin/announcements.
const data = (r) => r.data.data;
const ADMIN = "/api/connect/admin/announcements";

export const announcementsApi = {
  mine: () => api.get("/api/announcements").then(data),
  popup: () => api.get("/api/announcements/popup").then(data),
  get: (id) => api.get(`/api/announcements/${id}`).then(data),
  seen: (id) => api.post(`/api/announcements/${id}/seen`).then(data),
  ack: (id) => api.post(`/api/announcements/${id}/ack`).then(data),
  react: (id, kind) => api.post(`/api/announcements/${id}/react`, { kind }).then(data),
  comment: (id, body) => api.post(`/api/announcements/${id}/comments`, { body }).then(data),
  deleteComment: (id, commentId) => api.delete(`/api/announcements/${id}/comments/${commentId}`).then(data),

  options: () => api.get(`${ADMIN}/options`).then(data),
  count: (audience) => api.post(`${ADMIN}/count`, audience).then(data),
  list: () => api.get(ADMIN).then(data),
  detail: (id) => api.get(`${ADMIN}/${id}`).then(data),
  create: (body) => api.post(ADMIN, body).then(data),
  update: (id, body) => api.put(`${ADMIN}/${id}`, body).then(data),
  end: (id) => api.post(`${ADMIN}/${id}/end`).then(data),
  remove: (id) => api.delete(`${ADMIN}/${id}`).then(data),
  teamComment: (id, group, body) => api.post(`${ADMIN}/${id}/comments`, { group, body }).then(data),
  hideComment: (id, commentId, hidden) => api.post(`${ADMIN}/${id}/comments/${commentId}/hide`, { hidden }).then(data),
};

export const errorOf = (err, fallback = "Something went wrong") => err?.response?.data?.message || err?.message || fallback;
export const when = (d) => (d ? new Date(d).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "");
export const day = (d) => (d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "");
