import api from "../../../../services/api";

const BASE = "/api/sharing";

// Sharing between admins (owner-only — see server/src/modules/sharing/). Two admins who connect
// can each browse the other's content and copy what they want into their own workspace.
export const sharingApi = {
  kinds: () => api.get(`${BASE}/kinds`).then((r) => r.data.data),
  connections: () => api.get(`${BASE}/connections`).then((r) => r.data.data),
  request: (email) => api.post(`${BASE}/connections`, { email }).then((r) => r.data.data),
  accept: (id) => api.post(`${BASE}/connections/${id}/accept`).then((r) => r.data.data),
  remove: (id) => api.delete(`${BASE}/connections/${id}`).then((r) => r.data),
  browse: (id, kind) => api.get(`${BASE}/connections/${id}/content/${kind}`).then((r) => r.data.data),
  // A curriculum arrives with all its courses and assessments, so this one can take a while.
  copy: (id, kind, ids) => api.post(`${BASE}/connections/${id}/copy`, { kind, ids }, { timeout: 120000 }).then((r) => r.data.data),
};
