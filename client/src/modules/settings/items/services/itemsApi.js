import api from "../../../../services/api";

const BASE = "/api/items";

export const itemsApi = {
  getItems: () => api.get(BASE).then((r) => r.data.data),
  createItem: (data) => api.post(BASE, data).then((r) => r.data.data),
  updateItem: (id, data) => api.put(`${BASE}/${id}`, data).then((r) => r.data.data),
  deleteItem: (id) => api.delete(`${BASE}/${id}`).then((r) => r.data),
};
