import api from "../../../../services/api";

const BASE = "/api/bootcamps/games";

// The games library (Events → Games): games and play activities a bootcamp can include. Each
// game carries `usedIn` — how many bootcamps currently include it.
export const gamesApi = {
  getAll: () => api.get(BASE).then((r) => r.data.data),
  create: (data) => api.post(BASE, data).then((r) => r.data.data),
  update: (id, data) => api.put(`${BASE}/${id}`, data).then((r) => r.data.data),
  remove: (id) => api.delete(`${BASE}/${id}`).then((r) => r.data),
};
