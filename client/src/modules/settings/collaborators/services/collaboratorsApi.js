import api from "../../../../services/api";

const BASE = "/api/admin-tools/collaborators";

// A collaborator (see server/src/db/migrations/20260914090000_add_collaborator_role.js) gets
// edit access across the calling admin's whole tenant — one login, listed/invited/revoked here.
// Unlike admins (adminsApi.js's deliberately create-only, no-list posture — each admin is its own
// tenant, so seeing other admins would itself be a leak), collaborators genuinely belong to the
// inviting admin's own tenant, so listing/revoking them is safe and expected here.
export const collaboratorsApi = {
  list: () => api.get(BASE).then((r) => r.data.data),
  invite: (data) => api.post(BASE, data).then((r) => r.data.data),
  revoke: (id) => api.delete(`${BASE}/${id}`).then((r) => r.data),
};
