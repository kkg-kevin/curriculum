import api from "../../../services/api";

const ENDPOINT = "/api/assessment-templates";

export const templateApi = {
  getAll: (type) => api.get(ENDPOINT, { params: type ? { type } : undefined }).then((r) => r.data.data),
  create: (data) => api.post(ENDPOINT, data).then((r) => r.data.data),
  update: (id, data) => api.put(`${ENDPOINT}/${id}`, data).then((r) => r.data.data),
  remove: (id) => api.delete(`${ENDPOINT}/${id}`).then((r) => r.data),
};
