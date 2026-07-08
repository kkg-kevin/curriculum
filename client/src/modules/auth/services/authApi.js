import api from "../../../services/api";

const ENDPOINT = "/api/auth";

export const authApi = {
  signup: (payload) => api.post(`${ENDPOINT}/signup`, payload).then((r) => r.data.data),
  login: (email, password) => api.post(`${ENDPOINT}/login`, { email, password }).then((r) => r.data.data),
  logout: () => api.post(`${ENDPOINT}/logout`).then((r) => r.data),
  me: () => api.get(`${ENDPOINT}/me`).then((r) => r.data.data),
};
