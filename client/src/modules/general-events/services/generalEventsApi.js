import api, { checkDelete } from "../../../services/api";

// General events (server: modules/general-events/). /api/general-events is the admin side (staff:
// "general-events"); /api/my-events is anyone signed in — the sign-in pop-up and registering.
const BASE = "/api/general-events";
const MINE = "/api/my-events";
const data = (r) => r.data.data;

export const generalEventsApi = {
  list: () => api.get(BASE).then(data),
  options: () => api.get(`${BASE}/options`).then(data),
  get: (id) => api.get(`${BASE}/${id}`).then(data),
  create: (body) => api.post(BASE, body).then(data),
  update: (id, body) => api.put(`${BASE}/${id}`, body).then(data),
  remove: (id) => api.delete(`${BASE}/${id}`).then((r) => r.data),
  checkRemove: (id) => checkDelete(`${BASE}/${id}`),
  cancel: (id, body) => api.post(`${BASE}/${id}/cancel`, body).then(data),
  registrations: (id) => api.get(`${BASE}/${id}/registrations`).then(data),
  addRegistration: (id, body) => api.post(`${BASE}/${id}/registrations`, body).then(data),
  updateRegistration: (id, regId, body) => api.put(`${BASE}/${id}/registrations/${regId}`, body).then(data),
  arrived: (id, regId, arrived) => api.post(`${BASE}/${id}/registrations/${regId}/arrived`, { arrived }).then(data),
  message: (id, body) => api.post(`${BASE}/${id}/message`, body).then(data),
  invite: (id, audience) => api.post(`${BASE}/${id}/invite`, { audience }).then(data),
};

export const myEventsApi = {
  list: () => api.get(MINE).then(data),
  popup: (eventId) => api.get(`${MINE}/popup`, { params: eventId ? { event: eventId } : {} }).then(data),
  register: (id, body) => api.post(`${MINE}/${id}/register`, body).then(data),
  hide: (id, days) => api.post(`${MINE}/${id}/hide`, { days }).then(data),
  details: (regId, body) => api.put(`${MINE}/registrations/${regId}/details`, body).then(data),
  cancel: (regId) => api.post(`${MINE}/registrations/${regId}/cancel`).then(data),
};

export const errorOf = (err) => err?.response?.data?.errors?.[0]?.message || err?.response?.data?.message || err?.message || "Something went wrong";
