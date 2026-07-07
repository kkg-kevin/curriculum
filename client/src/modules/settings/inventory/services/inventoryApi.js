import api from "../../../../services/api";

const BASE = "/api/inventory";

export const inventoryApi = {
  getInventoryItems: () => api.get(BASE).then((r) => r.data.data),
  createInventoryItem: (data) => api.post(BASE, data).then((r) => r.data.data),
  updateInventoryItem: (id, data) => api.put(`${BASE}/${id}`, data).then((r) => r.data.data),
  deleteInventoryItem: (id) => api.delete(`${BASE}/${id}`).then((r) => r.data),
};
