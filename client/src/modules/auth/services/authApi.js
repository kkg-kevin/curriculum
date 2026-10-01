import api from "../../../services/api";

const ENDPOINT = "/api/auth";

export const authApi = {
  signup: (payload) => api.post(`${ENDPOINT}/signup`, payload).then((r) => r.data.data),
  // `identifier` is either an account's own email or a learner's username — see
  // auth.service.js's login on the server for how the two resolve to the same account.
  login: (identifier, password) => api.post(`${ENDPOINT}/login`, { identifier, password }).then((r) => r.data.data),
  logout: () => api.post(`${ENDPOINT}/logout`).then((r) => r.data),
  me: () => api.get(`${ENDPOINT}/me`).then((r) => r.data.data),
  // "The user is still here" — the only thing that keeps a session from timing out (see
  // client/src/context/session.js). Background polling deliberately doesn't count.
  activity: () => api.post(`${ENDPOINT}/activity`).then((r) => r.data.data),
  updateMe: (data) => api.put(`${ENDPOINT}/me`, data).then((r) => r.data.data),
  // Re-confirms the CURRENTLY logged-in user's own password without touching their session —
  // used to re-gate the learner-portal's sibling switcher (see LearnerPortalLayout) before it
  // flips to a different linked learner under the same guardian login.
  verifyPassword: (password) => api.post(`${ENDPOINT}/verify-password`, { password }).then((r) => r.data),
  // Self-service password change — most immediately useful for a learner auto-provisioned with
  // a temporary password (see bootcamp-enrollment.service.js) who wants to set their own.
  changePassword: (currentPassword, newPassword) => api.patch(`${ENDPOINT}/change-password`, { currentPassword, newPassword }).then((r) => r.data),
  // Forgot password — emails a one-time reset link. The server answers the same way whether or
  // not the email/username matched an account. The link opens /reset-password?token=…, which
  // checks the token up front and then sets the new password with it.
  forgotPassword: (identifier) => api.post(`${ENDPOINT}/forgot-password`, { identifier }).then((r) => r.data),
  checkResetToken: (token) => api.get(`${ENDPOINT}/reset-password/${encodeURIComponent(token)}`).then((r) => r.data.data),
  resetPassword: (token, newPassword) => api.post(`${ENDPOINT}/reset-password`, { token, newPassword }).then((r) => r.data.data),
};
