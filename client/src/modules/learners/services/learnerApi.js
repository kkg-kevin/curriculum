import api from "../../../services/api";

const BASE = "/api/learners";

export const learnerApi = {
  create:  (data)       => api.post(BASE, data).then((r) => r.data.data),
  bulkImport: (data)    => api.post(`${BASE}/bulk-import`, data).then((r) => r.data.data),
  getAll:  (params)     => api.get(BASE, { params }).then((r) => r.data),
  getById: (id)         => api.get(`${BASE}/${id}`).then((r) => r.data.data),
  update:  (id, data)   => api.put(`${BASE}/${id}`, data).then((r) => r.data.data),
  updateAccountStatus: (id, accountStatus) => api.patch(`${BASE}/${id}/account-status`, { accountStatus }).then((r) => r.data.data),
  remove:  (id)         => api.delete(`${BASE}/${id}`).then((r) => r.data),
  getHubs:   (id)                  => api.get(`${BASE}/${id}/hubs/links`).then((r) => r.data.data),
  enrollHub: (id, data)            => api.post(`${BASE}/${id}/hubs/links`, data).then((r) => r.data.data),
  updateHub: (id, hubId, data)     => api.put(`${BASE}/${id}/hubs/links/${hubId}`, data).then((r) => r.data.data),
  unenrollHub: (id, hubId)         => api.delete(`${BASE}/${id}/hubs/links/${hubId}`).then((r) => r.data.data),
  transferHub: (id, hubId, data)   => api.post(`${BASE}/${id}/hubs/links/${hubId}/transfer`, data).then((r) => r.data.data),
  ensureDiagnosticsIssued: (id, hubId) => api.post(`${BASE}/${id}/ensure-diagnostics`, { hubId }).then((r) => r.data),
  completeHubOnboarding: (id, hubId) => api.post(`${BASE}/${id}/hubs/${hubId}/complete-onboarding`).then((r) => r.data),
  getPublicToken: (id) => api.post(`${BASE}/${id}/public-token`).then((r) => r.data.data),
  regeneratePublicToken: (id) => api.post(`${BASE}/${id}/public-token/regenerate`).then((r) => r.data.data),
  // Unauthenticated on purpose — this is the scan destination itself (see
  // PublicLearnerProfilePage), fetched by a browser that's often not logged in at all. Hits the
  // separate /api/public/learners router directly rather than BASE, since that's a different,
  // deliberately unprotected mount in app.js.
  getPublicProfile: (token) => api.get(`/api/public/learners/${token}`).then((r) => r.data.data),
};
