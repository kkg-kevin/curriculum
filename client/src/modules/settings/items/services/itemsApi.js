import api from "../../../../services/api";

// Settings → Items (Goods + Services). `kind` filters the list; omit it for the whole catalog.
const BASE = "/api/items";

export const itemsApi = {
  getItems: (kind) => api.get(BASE, { params: kind ? { kind } : {} }).then((r) => r.data.data),
  createItem: (data) => api.post(BASE, data).then((r) => r.data.data),
  updateItem: (id, data) => api.put(`${BASE}/${id}`, data).then((r) => r.data.data),
  deleteItem: (id) => api.delete(`${BASE}/${id}`).then((r) => r.data),
};
