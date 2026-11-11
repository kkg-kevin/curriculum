import api from "../../../services/api";

// Mentor bookings (server/src/modules/mentor-bookings/).
const BASE = "/api/mentor-bookings";
const data = (r) => r.data.data;

export const mentorBookingsApi = {
  // Settings → Educator Pay → Mentor bookings.
  settings: () => api.get(`${BASE}/settings`).then(data),
  saveSettings: (body) => api.put(`${BASE}/settings`, body).then(data),

  // Booking (parents).
  options: (params) => api.get(`${BASE}/options`, { params }).then(data),
  freeTimes: (params) => api.get(`${BASE}/free-times`, { params }).then(data),
  book: (body) => api.post(BASE, body).then(data),

  list: (params) => api.get(BASE, { params }).then(data),
  get: (id) => api.get(`${BASE}/${id}`).then(data),
  cancel: (id, body) => api.post(`${BASE}/${id}/cancel`, body).then(data),
  mark: (id, body) => api.post(`${BASE}/${id}/mark`, body).then(data),
  setLink: (id, meetingLink) => api.put(`${BASE}/${id}/link`, { meetingLink }).then(data),
  refunded: (id, body) => api.post(`${BASE}/${id}/refunded`, body).then(data),

  // Help requests.
  help: () => api.get(`${BASE}/help`).then(data),
  askForHelp: (body) => api.post(`${BASE}/help`, body).then(data),
  closeHelp: (id) => api.post(`${BASE}/help/${id}/close`).then(data),

  // Partner hubs' desk fees.
  hubs: () => api.get(`${BASE}/hubs`).then(data),
  statement: (hubId) => api.get(`${BASE}/hubs/${hubId}/statement`).then(data),
  settle: (hubId, body) => api.post(`${BASE}/hubs/${hubId}/settle`, body).then(data),

  // A mentor's held sessions waiting to be claimed (claims module).
  earnings: () => api.get("/api/claims/bookings").then(data),
  claimEarnings: (body) => api.post("/api/claims/bookings", body).then(data),
};
