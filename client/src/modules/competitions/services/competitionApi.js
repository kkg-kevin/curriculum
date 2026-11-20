import api, { checkDelete } from "../../../services/api";

const BASE = "/api/competitions";

export const competitionApi = {
  create:  (data)     => api.post(BASE, data).then((r) => r.data.data),
  getAll:  (params)   => api.get(BASE, { params }).then((r) => r.data.data),
  getById: (id)       => api.get(`${BASE}/${id}`).then((r) => r.data.data),
  update:  (id, data) => api.put(`${BASE}/${id}`, data).then((r) => r.data.data),
  remove:  (id)       => api.delete(`${BASE}/${id}`).then((r) => r.data),
  // "Is anyone registered?" before a delete (ConfirmDialog's usageCheck).
  checkRemove: (id)   => checkDelete(`${BASE}/${id}`),

  // Registrations made on the website (20 Nov 2026).
  registrations:      (id)                  => api.get(`${BASE}/${id}/registrations`).then((r) => r.data.data),
  cancelRegistration: (id, regId, reason)   => api.post(`${BASE}/${id}/registrations/${regId}/cancel`, { reason }).then((r) => r.data.data),

  // Hub-offerings — "run this competition at a hub". Replaces the old standalone Event-
  // deployment flow; nested under the competition since an offering has no identity outside
  // its parent.
  listHubs:  (id)         => api.get(`${BASE}/${id}/hubs`).then((r) => r.data.data),
  addHub:    (id, data)   => api.post(`${BASE}/${id}/hubs`, data).then((r) => r.data.data),
  removeHub: (id, offeringId) => api.delete(`${BASE}/${id}/hubs/${offeringId}`).then((r) => r.data),
};
