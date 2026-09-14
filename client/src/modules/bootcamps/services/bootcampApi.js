import api from "../../../services/api";

const BASE = "/api/bootcamps";

export const bootcampApi = {
  create:  (data)     => api.post(BASE, data).then((r) => r.data.data),
  getAll:  (params)   => api.get(BASE, { params }).then((r) => r.data.data),
  getById: (id)       => api.get(`${BASE}/${id}`).then((r) => r.data.data),
  update:  (id, data) => api.put(`${BASE}/${id}`, data).then((r) => r.data.data),
  remove:  (id)       => api.delete(`${BASE}/${id}`).then((r) => r.data),

  // Hub-offerings — "run this bootcamp at a hub". Replaces the old standalone Event-deployment
  // flow; nested under the bootcamp since an offering has no identity outside its parent.
  listHubs:  (id)         => api.get(`${BASE}/${id}/hubs`).then((r) => r.data.data),
  addHub:    (id, data)   => api.post(`${BASE}/${id}/hubs`, data).then((r) => r.data.data),
  removeHub: (id, offeringId) => api.delete(`${BASE}/${id}/hubs/${offeringId}`).then((r) => r.data),
};
