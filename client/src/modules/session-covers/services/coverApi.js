import api from "../../../services/api";

// Session covers (19 Nov 2026) — one educator teaches one session of another's class. Server:
// server/src/modules/session-covers/.
const BASE = "/api/covers";
const data = (r) => r.data.data;

export const coverApi = {
  // { session: { date, startTime, endTime }, educators: [{ id, name, sameHub, hasLogin, busy }] }
  candidates: ({ classId, courseId, sessionId, date }) => api.get(`${BASE}/candidates`, { params: { classId, courseId, sessionId, date } }).then(data),
  request: (body) => api.post(BASE, body).then(data),
  mine: () => api.get(`${BASE}/mine`).then(data),
  overview: () => api.get(BASE).then(data),
  respond: (id, body) => api.post(`${BASE}/${id}/respond`, body).then(data),
  cancel: (id, reason) => api.post(`${BASE}/${id}/cancel`, { reason }).then(data),
  page: (id) => api.get(`${BASE}/${id}/page`).then(data),
  attendance: (id, records) => api.post(`${BASE}/${id}/attendance`, { records }).then(data),
  taught: (id) => api.post(`${BASE}/${id}/taught`, {}).then(data),
  // Pay for covered sessions (claims/, type "covers").
  earnings: () => api.get("/api/claims/covers").then(data),
  claimEarnings: (body) => api.post("/api/claims/covers", body).then(data),
};
