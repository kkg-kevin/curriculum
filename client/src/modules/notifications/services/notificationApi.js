import api from "../../../services/api";

const ENDPOINT = "/api/notifications";

// Scoped entirely by the logged-in session server-side (see notification.routes.js) — every
// role/portal calls the exact same three endpoints, no per-role branching needed here.
export const notificationApi = {
  list: () => api.get(ENDPOINT).then((r) => r.data.data),
  markRead: (id) => api.patch(`${ENDPOINT}/${id}/read`).then((r) => r.data.data),
  markAllRead: () => api.patch(`${ENDPOINT}/read-all`).then((r) => r.data),
};
