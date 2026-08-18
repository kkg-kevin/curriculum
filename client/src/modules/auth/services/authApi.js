import api from "../../../services/api";

const ENDPOINT = "/api/auth";

export const authApi = {
  signup: (payload) => api.post(`${ENDPOINT}/signup`, payload).then((r) => r.data.data),
  // `identifier` is either an account's own email or a learner's username — see
  // auth.service.js's login on the server for how the two resolve to the same account.
  login: (identifier, password) => api.post(`${ENDPOINT}/login`, { identifier, password }).then((r) => r.data.data),
  logout: () => api.post(`${ENDPOINT}/logout`).then((r) => r.data),
  me: () => api.get(`${ENDPOINT}/me`).then((r) => r.data.data),
  updateMe: (data) => api.put(`${ENDPOINT}/me`, data).then((r) => r.data.data),
  // Re-confirms the CURRENTLY logged-in user's own password without touching their session —
  // used to re-gate the learner-portal's sibling switcher (see LearnerPortalLayout) before it
  // flips to a different linked learner under the same guardian login.
  verifyPassword: (password) => api.post(`${ENDPOINT}/verify-password`, { password }).then((r) => r.data),
};
