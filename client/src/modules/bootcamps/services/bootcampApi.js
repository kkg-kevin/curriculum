import api, { checkDelete } from "../../../services/api";

const BASE = "/api/bootcamps";

export const bootcampApi = {
  create:  (data)     => api.post(BASE, data).then((r) => r.data.data),
  getAll:  (params)   => api.get(BASE, { params }).then((r) => r.data.data),
  getById: (id)       => api.get(`${BASE}/${id}`).then((r) => r.data.data),
  update:  (id, data) => api.put(`${BASE}/${id}`, data).then((r) => r.data.data),
  remove:  (id)       => api.delete(`${BASE}/${id}`).then((r) => r.data),
  checkRemove: (id) => checkDelete(`${BASE}/${id}`),

  // Runs of the same bootcamp: every run, and "Schedule another run" — a copy with new dates,
  // answering { bootcamp, hubs: [{ hubId, ok, message }] }.
  runs:        (id)       => api.get(`${BASE}/${id}/runs`).then((r) => r.data.data),
  scheduleRun: (id, data) => api.post(`${BASE}/${id}/runs`, data).then((r) => r.data.data),
  // The learners and parents who took part — scope "run" (this one) or "series" (every run).
  participants: (id, scope) => api.get(`${BASE}/${id}/participants`, { params: { scope } }).then((r) => r.data.data),

  // Hub-offerings — "run this bootcamp at a hub". Replaces the old standalone Event-deployment
  // flow; nested under the bootcamp since an offering has no identity outside its parent.
  listHubs:  (id)         => api.get(`${BASE}/${id}/hubs`).then((r) => r.data.data),
  addHub:    (id, data)   => api.post(`${BASE}/${id}/hubs`, data).then((r) => r.data.data),
  removeHub: (id, offeringId) => api.delete(`${BASE}/${id}/hubs/${offeringId}`).then((r) => r.data),
};
