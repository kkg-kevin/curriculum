import api from "../../../services/api";

const BASE = "/api/billing";

export const billingApi = {
  list: () => api.get(BASE).then((r) => r.data),
  get: (id) => api.get(`${BASE}/${id}`).then((r) => r.data.data),
  create: (data) => api.post(BASE, data).then((r) => r.data.data),
  update: (id, data) => api.patch(`${BASE}/${id}`, data).then((r) => r.data.data),
  issue: (id) => api.post(`${BASE}/${id}/issue`).then((r) => r.data.data),
  cancel: (id) => api.post(`${BASE}/${id}/cancel`).then((r) => r.data.data),
  pay: (id, data) => api.post(`${BASE}/${id}/payments`, data).then((r) => r.data.data),
};
