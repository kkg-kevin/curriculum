import api from "../../../services/api";

const BASE = "/api/certificates";
const SETTINGS = "/api/certificate-settings";

// A certificate is never created here: a course certificate is issued when a learner's final
// course report is published, and pathway and bootcamp certificates follow from those (server:
// certificate.service.js). Staff can read them, and revoke or reinstate one by hand.
export const certificateApi = {
  // hubId scopes to the hub the portal switcher is on; omitted returns every hub's certificates.
  getMine:        (hubId)             => api.get(`${BASE}/learner/mine`, { params: hubId ? { hubId } : {} }).then((r) => r.data.data),
  // What this learner can earn next: { courses: [...], pathways: [...] }, each { title, done, total }.
  getMyProgress:  (hubId)             => api.get(`${BASE}/learner/progress`, { params: hubId ? { hubId } : {} }).then((r) => r.data.data),
  listForLearner: (learnerId)         => api.get(BASE, { params: { learnerId } }).then((r) => r.data.data),
  listForClass:   (classId, courseId) => api.get(BASE, { params: { classId, courseId } }).then((r) => r.data.data),
  // Admin / school: every certificate in the workspace or hub. filters: { hubId, kind, status, q }.
  listAll:        (filters = {})      => api.get(BASE, { params: Object.fromEntries(Object.entries(filters).filter(([, v]) => v)) }).then((r) => r.data.data),
  getById:        (id)                => api.get(`${BASE}/${id}`).then((r) => r.data.data),
  revoke:         (id, reason)        => api.post(`${BASE}/${id}/revoke`, { reason }).then((r) => r.data.data),
  reinstate:      (id)                => api.post(`${BASE}/${id}/reinstate`).then((r) => r.data.data),
  // Who signs the workspace's certificates (owner only).
  getSettings:    ()                  => api.get(SETTINGS).then((r) => r.data.data),
  saveSettings:   (values)            => api.put(SETTINGS, values).then((r) => r.data.data),
  // No sign-in needed — the verification link printed on the certificate.
  verify:         (token)             => api.get(`/api/public/certificates/${encodeURIComponent(token)}`).then((r) => r.data.data),
};
