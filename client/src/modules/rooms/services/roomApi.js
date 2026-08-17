import api from "../../../services/api";

const BASE = "/api/rooms";

export const roomApi = {
  create:  (data)     => api.post(BASE, data).then((r) => r.data.data),
  getAll:  (params)   => api.get(BASE, { params }).then((r) => r.data),
  getById: (id)       => api.get(`${BASE}/${id}`).then((r) => r.data.data),
  update:  (id, data) => api.put(`${BASE}/${id}`, data).then((r) => r.data.data),
  remove:  (id)       => api.delete(`${BASE}/${id}`).then((r) => r.data),
  getAvailability: (params) => api.get(`${BASE}/availability`, { params }).then((r) => r.data.data),
};
