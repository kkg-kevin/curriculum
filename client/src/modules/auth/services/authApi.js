import api from "../../../services/api";

const ENDPOINT = "/api/auth";

export const authApi = {
  signup: (payload) => api.post(`${ENDPOINT}/signup`, payload).then((r) => r.data.data),
  // `identifier` is either an account's own email or a learner's username — see
  // auth.service.js's login on the server for how the two resolve to the same account.
  login: (identifier, password) => api.post(`${ENDPOINT}/login`, { identifier, password }).then((r) => r.data.data),
  logout: () => api.post(`${ENDPOINT}/logout`).then((r) => r.data),
  me: () => api.get(`${ENDPOINT}/me`).then((r) => r.data.data),
};
