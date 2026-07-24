import api from "../../../services/api";

const BASE = "/api/programs";

export const programApi = {
  create:  (data)     => api.post(BASE, data).then((r) => r.data.data),
  getAll:  ()          => api.get(BASE).then((r) => r.data.data),
  getById: (id)        => api.get(`${BASE}/${id}`).then((r) => r.data.data),
  update:  (id, data) => api.put(`${BASE}/${id}`, data).then((r) => r.data.data),
  remove:  (id)        => api.delete(`${BASE}/${id}`).then((r) => r.data),
};
