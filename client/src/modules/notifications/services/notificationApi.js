import api from "../../../services/api";

const ENDPOINT = "/api/notifications";

// Scoped entirely by the logged-in session server-side (see notification.routes.js) — every
// role/portal calls the exact same three endpoints, no per-role branching needed here.
export const notificationApi = {
  list: () => api.get(ENDPOINT).then((r) => r.data.data),
  markRead: (id) => api.patch(`${ENDPOINT}/${id}/read`).then((r) => r.data.data),
  markAllRead: () => api.patch(`${ENDPOINT}/read-all`).then((r) => r.data),
  // Which notifications this account also gets by email — { email, enabled, types: [{ type, label, enabled }] }.
  getEmailPreferences: () => api.get(`${ENDPOINT}/email-preferences`).then((r) => r.data.data),
  updateEmailPreferences: (data) => api.put(`${ENDPOINT}/email-preferences`, data).then((r) => r.data.data),
  // The same two for someone who isn't signed in — the token comes from the link in an email's footer.
  getEmailPreferencesByToken: (token) => api.get(`/api/public/email-preferences/${encodeURIComponent(token)}`).then((r) => r.data.data),
  updateEmailPreferencesByToken: (token, data) => api.put(`/api/public/email-preferences/${encodeURIComponent(token)}`, data).then((r) => r.data.data),
  // Which emails the whole workspace sends (owner only) — { types: [{ type, label, group, enabled }] }.
  getWorkspaceEmails: () => api.get("/api/email-settings").then((r) => r.data.data),
  updateWorkspaceEmails: (types) => api.put("/api/email-settings", { types }).then((r) => r.data.data),
};
