import api from "../../../services/api";

const BASE = "/api/learners";

export const learnerApi = {
  create:  (data)       => api.post(BASE, data).then((r) => r.data.data),
  getAll:  (params)     => api.get(BASE, { params }).then((r) => r.data),
  getById: (id)         => api.get(`${BASE}/${id}`).then((r) => r.data.data),
  update:  (id, data)   => api.put(`${BASE}/${id}`, data).then((r) => r.data.data),
  remove:  (id)         => api.delete(`${BASE}/${id}`).then((r) => r.data),
  getHubs:   (id)                  => api.get(`${BASE}/${id}/hubs/links`).then((r) => r.data.data),
  enrollHub: (id, data)            => api.post(`${BASE}/${id}/hubs/links`, data).then((r) => r.data.data),
  updateHub: (id, hubId, data)     => api.put(`${BASE}/${id}/hubs/links/${hubId}`, data).then((r) => r.data.data),
  unenrollHub: (id, hubId)         => api.delete(`${BASE}/${id}/hubs/links/${hubId}`).then((r) => r.data.data),
};
